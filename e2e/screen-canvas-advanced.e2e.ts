import { expect, test } from "@playwright/test";

import { BACKEND_URL, getAccessToken, login, openMenuPath } from "./helpers";

/**
 * 大屏画布进阶：旋转几何 / 模板版本回滚 / 跨设备（云端）剪贴板。
 *
 * 三期 spec 只验到「旋转能设置并渲染」；本用例补三处端到端口径：
 * 1. **旋转 OBB 几何**：框选命中按旋转矩形——正例（框完全落在未旋转盒之外、只与旋转矩形相交
 *    → 应选中）与反例（只压外接 AABB 的角落、不在旋转矩形内 → 不选中）成对，钉住「不是按
 *    外接 AABB 命中」；对齐按**视觉盒**（外接 AABB）算基准，位移只施加到未旋转的 x；
 * 2. **模板版本历史**：团队模板每次写入记一版 → 弹窗列出 → 回滚到旧版（名称 / 分组还原，
 *    且回滚本身再记一版，可再回滚）；
 * 3. **云端剪贴板**：复制双写服务端槽位；抹掉本地剪贴板后「云端粘贴」仍能插入（证明走云端）。
 *
 * 几何断言要求页坐标可换算，因此先切 100% 缩放（页坐标 = 画布内容原点 + 画布坐标）。
 */
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function postJson(
  page: Parameters<typeof getAccessToken>[0],
  url: string,
  token: string,
  data: object
) {
  const resp = await page.request.post(url, { headers: auth(token), data });
  const payload = await resp.json();
  expect(
    payload.code,
    `POST ${url} 失败：${JSON.stringify(payload).slice(0, 300)}`
  ).toBe(1000);
  return payload.data as Record<string, string>;
}

/** 点保存并等这一次 PATCH 真正返回（提示可能沿用上一次，见 e2e/README 教训表） */
async function saveAndWait(
  page: Parameters<typeof getAccessToken>[0],
  screenPk: string
) {
  const patch = page.waitForResponse(
    resp =>
      resp.url().includes(`/api/dataset/screens/${screenPk}`) &&
      resp.request().method() === "PATCH"
  );
  await page.getByTestId("designer-save").click();
  const body = (await (await patch).json()) as { code: number };
  expect(body.code).toBe(1000);
  await expect(page.locator(".designer-header .el-tag")).toHaveCount(0);
}

/**
 * 弹窗（ElMessageBox）内按文案点按钮。
 * 取 `.last()`：连续弹窗时上一个的 DOM 还在退场动画里（strict mode 会撞到两个）。
 */
async function clickBoxButton(
  page: Parameters<typeof getAccessToken>[0],
  label: string
) {
  const box = page.locator(".el-message-box").last();
  await expect(box).toBeVisible();
  await box.getByRole("button", { name: label, exact: true }).click();
}

async function dragOnPage(
  page: Parameters<typeof getAccessToken>[0],
  from: { x: number; y: number },
  to: { x: number; y: number }
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
}

test("画布进阶：旋转几何命中 / 视觉盒对齐 / 模板版本回滚 / 云端剪贴板", async ({
  page
}) => {
  const suffix = Math.random().toString(36).slice(2, 8);
  const screenName = `E2E进阶-${suffix}`;
  const templateName = `E2E版本模板-${suffix}`;
  const renamedName = `${templateName}-改`;
  const templateGroup = "版本分组";

  await login(page);
  const token = await getAccessToken(page);
  const screen = await postJson(
    page,
    `${BACKEND_URL}/api/dataset/screens`,
    token,
    { name: screenName, dashboards: [], layout: [], visibility: "shared" }
  );

  // ---- 进设计器 / 自由模式 / 100% 缩放（几何断言的前提）----
  await openMenuPath(page, ["数据分析"], "/analysis/screen/index");
  await page
    .getByRole("row", { name: screenName })
    .getByRole("button", { name: "设计" })
    .click();
  await expect(page).toHaveURL(/\/analysis\/screen\/designer/);
  await expect(page.getByTestId("designer-canvas")).toBeVisible({
    timeout: 15_000
  });
  await page.getByTestId("designer-mode-free").click();
  const freeCanvas = page.getByTestId("free-canvas");
  await expect(freeCanvas).toBeVisible();
  const paneEls = freeCanvas.locator(".re-resize");
  const stage = page.getByTestId("free-stage");
  const zoomOf = async () => Number(await stage.getAttribute("data-zoom"));
  const activeCount = () => freeCanvas.locator(".re-resize.is-active").count();
  await page.getByTestId("free-zoom-100").click();
  expect(await zoomOf()).toBe(1);

  // 画布内容原点（跳过 1px 边框）：zoom = 1 时页坐标 = 原点 + 画布坐标
  const origin = await freeCanvas.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return { x: rect.left + el.clientLeft, y: rect.top + el.clientTop };
  });
  const toPage = (x: number, y: number) => ({
    x: origin.x + x,
    y: origin.y + y
  });

  /** 读窗格的未旋转盒模型（缩放在外层 transform 上，不改内联样式） */
  const boxOf = async (index: number) => {
    const style = await paneEls.nth(index).evaluate(el => {
      const node = el as HTMLElement;
      return {
        x: node.style.left,
        y: node.style.top,
        w: node.style.width,
        h: node.style.height
      };
    });
    const px = (value: string) => Number(value.replace("px", ""));
    return {
      x: px(style.x),
      y: px(style.y),
      w: px(style.w),
      h: px(style.h)
    };
  };

  /**
   * 命中探测：点是否落在某元素（含旋转后的实际形状）上。
   * `sel` 取 `.re-resize` = 压在窗格上（框选起手必须在空白处）；
   * 取 `[data-testid="free-canvas"]` = 坐标换算没跑出画布。
   */
  const hits = (point: { x: number; y: number }, selector: string) =>
    page.evaluate(
      ({ pt, sel }) =>
        Boolean(document.elementFromPoint(pt.x, pt.y)?.closest(sel)),
      { pt: point, sel: selector }
    );

  /** 属性面板里的成对数字输入（位置 = x / y，尺寸 = w / h） */
  const pairInputs = (label: string) =>
    page
      .locator(".pane-inspector .el-form-item")
      .filter({ hasText: label })
      .first()
      .locator("input");
  /** 通过属性面板把窗格摆成确定的盒模型（几何断言的前提） */
  const setPaneBox = async (x: number, y: number, w: number, h: number) => {
    for (const [input, value] of [
      [pairInputs("位置").nth(0), x],
      [pairInputs("位置").nth(1), y],
      [pairInputs("尺寸").nth(0), w],
      [pairInputs("尺寸").nth(1), h]
    ] as const) {
      await input.fill(String(value));
      await input.press("Enter");
    }
  };

  // ---- 旋转 45°：先把窗格摆成确定的盒模型 ----
  // 画布（1920 宽）比可视区宽：盒模型收在左上可视区里，算出的探测点才不会被右侧属性面板盖住
  await page.getByTestId("palette-text").click();
  await expect(paneEls).toHaveCount(1);
  await setPaneBox(200, 300, 320, 120);
  const rotateInput = page.getByTestId("inspector-rotate").locator("input");
  await rotateInput.fill("45");
  await rotateInput.press("Enter");
  await expect(freeCanvas.locator(".screen-pane").first()).toHaveAttribute(
    "style",
    /rotate\(45deg\)/
  );

  const box = await boxOf(0);
  // 位置 / 尺寸输入已生效（几何断言的前提；x 会被后续对齐改动，这里只钉其余三项）
  expect([box.y, box.w, box.h]).toEqual([300, 320, 120]);
  /**
   * 旋转 45° 后的多边形（相对中心）：外接半宽 / 半高均为 B，四个顶点为
   * (±A, ±B) 与 (±B, ±A)，其中 A = (w−h)·√2/4、B = (w+h)·√2/4。
   * 多边形内部 = { |u+v| ≤ A+B 且 |v−u| ≤ B−A }（w ≥ h 时成立）。
   */
  const A = ((box.w - box.h) * Math.SQRT1_2) / 2;
  const B = ((box.w + box.h) * Math.SQRT1_2) / 2;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  // 「未旋转盒底边之外、旋转矩形之内」的带（u = 0 处）要够宽，正例才站得住
  expect(B - A).toBeGreaterThan(box.h / 2 + 14);

  /**
   * 正例：起于未旋转盒底边之外的空白（该处 |v−u| > B−A），左下→右上收进旋转矩形。
   * `uLeft` 由「起点必须落在旋转矩形之外（留 5px 余量）」反推，尺寸变化时仍然成立。
   */
  const vTop = box.h / 2 + 6;
  const vBottom = B - A - 3;
  const uLeft = vTop - (B - A) - 5;
  const positiveFrom = toPage(cx + uLeft, cy + vTop);
  const positiveTo = toPage(cx + 25, cy + vBottom);
  expect(await hits(positiveFrom, '[data-testid="free-canvas"]')).toBe(true);
  expect(await hits(positiveFrom, ".re-resize")).toBe(false);
  await dragOnPage(page, positiveFrom, positiveTo);
  await expect.poll(activeCount).toBe(1);
  await expect(
    freeCanvas.locator(".re-resize.is-active .screen-pane")
  ).toHaveAttribute("style", /rotate\(45deg\)/);

  // 反例：只压外接 AABB 的右上角（旋转矩形之外）——按 AABB 命中会误选，按旋转矩形不该选
  const negativeFrom = toPage(cx + B - 25, cy - B + 2);
  const negativeTo = toPage(cx + B - 8, cy - B + 16);
  expect(await hits(negativeFrom, '[data-testid="free-canvas"]')).toBe(true);
  expect(await hits(negativeFrom, ".re-resize")).toBe(false);
  await dragOnPage(page, negativeFrom, negativeTo);
  await expect.poll(activeCount).toBe(0);

  // ---- 视觉盒对齐：旋转窗格按外接 AABB 参与对齐（位移只落回未旋转 x）----
  await page.getByTestId("palette-text").click();
  await expect(paneEls).toHaveCount(2);
  // 第二格摆在旋转窗格视觉盒的右侧、且**在下方**：对齐后两格不重叠（后面还要点第一格）
  await setPaneBox(400, 600, 320, 120);
  const second = await boxOf(1);
  /** rot = 45 时视觉盒左边界（外接 AABB：半宽 = (w+h)·√2/4） */
  const visualLeftOfRotated = (item: { x: number; w: number; h: number }) =>
    item.x + item.w / 2 - ((item.w + item.h) * Math.SQRT1_2) / 2;

  expect(Math.abs(visualLeftOfRotated(box) - second.x)).toBeGreaterThan(2);
  // 点画布空白：把焦点从属性面板输入框移开（否则 Ctrl+A 被输入框吃掉，画布收不到）
  const blank = toPage(cx + 340, cy - 140);
  await page.mouse.click(blank.x, blank.y);
  await page.keyboard.press("Control+a");
  await expect(page.getByTestId("multi-count")).toContainText("2");
  await page.getByTestId("align-left").click();
  const alignedFirst = await boxOf(0);
  const alignedSecond = await boxOf(1);
  // 两个视觉盒左边界对齐（1px 容差：整数化 / 边框换算）
  expect(
    Math.abs(visualLeftOfRotated(alignedFirst) - alignedSecond.x)
  ).toBeLessThanOrEqual(1);
  expect(alignedFirst.x).toBeGreaterThanOrEqual(0);

  // ---- 团队模板：另存（名称 + 分组 + 可见性）→ 每次写入记一版 ----
  await page.getByTestId("free-template-save-server").click();
  await page.locator(".el-message-box input").last().fill(templateName);
  await clickBoxButton(page, "保存为模板");
  await page.locator(".el-message-box input").last().fill(templateGroup);
  await clickBoxButton(page, "保存为模板");
  await clickBoxButton(page, "团队共享");
  await expect(page.getByText(/已保存为团队模板/)).toBeVisible();

  const templatePk = await (async () => {
    const res = await page.request.get(
      `${BACKEND_URL}/api/dataset/screen-templates`,
      { headers: auth(token) }
    );
    const rows = (await res.json()).data.results as {
      pk: string;
      name: string;
    }[];
    return rows.find(item => item.name === templateName)?.pk;
  })();
  expect(templatePk).toBeTruthy();
  const versionsOf = async (pk: string) => {
    const res = await page.request.get(
      `${BACKEND_URL}/api/dataset/screen-templates/${pk}/versions`,
      { headers: auth(token) }
    );
    return ((await res.json()).data ?? []) as {
      version: number;
      name: string;
      group?: string;
    }[];
  };
  const firstVersions = await versionsOf(templatePk!);
  expect(firstVersions.map(item => item.version)).toEqual([1]);
  expect(firstVersions[0].name).toBe(templateName);
  expect(firstVersions[0].group).toBe(templateGroup);

  // 重命名 = PATCH → 记第二版（最新在前）
  await page.getByTestId("free-template-manage").click();
  await page
    .locator(".el-dropdown-menu__item")
    .filter({ hasText: `重命名 · ${templateName}` })
    .first()
    .click();
  await page.locator(".el-message-box input").last().fill(renamedName);
  await clickBoxButton(page, "保存为模板");
  await expect(page.getByText(/模板已重命名/)).toBeVisible();
  const secondVersions = await versionsOf(templatePk!);
  expect(secondVersions.map(item => item.version)).toEqual([2, 1]);
  expect(secondVersions[0].name).toBe(renamedName);

  // 版本历史弹窗 → 回滚到 v1：名称 / 分组还原，且回滚本身再记一版（可再回滚）
  await page.getByTestId("free-template-manage").click();
  await page
    .locator(".el-dropdown-menu__item")
    .filter({ hasText: `版本历史 · ${renamedName}` })
    .first()
    .click();
  const dialog = page.getByTestId("template-versions-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("tbody tr")).toHaveCount(2);
  await dialog.getByTestId("version-rollback-1").click();
  await clickBoxButton(page, "回滚");
  await expect(page.getByText(/已回滚到版本 1/)).toBeVisible();
  const rolledBack = await page.request.get(
    `${BACKEND_URL}/api/dataset/screen-templates/${templatePk}`,
    { headers: auth(token) }
  );
  const rolledBackData = (await rolledBack.json()).data as {
    name: string;
    group?: string;
  };
  expect(rolledBackData.name).toBe(templateName);
  expect(rolledBackData.group).toBe(templateGroup);
  const thirdVersions = await versionsOf(templatePk!);
  expect(thirdVersions.map(item => item.version)).toEqual([3, 2, 1]);
  expect(thirdVersions[0].name).toBe(templateName);
  await dialog.locator(".el-dialog__headerbtn").click();
  await expect(dialog).not.toBeVisible();

  // ---- 云端剪贴板：复制双写服务端槽位 → 抹掉本地 → 云端粘贴仍能插入 ----
  await page.keyboard.press("Escape");
  await paneEls.first().click();
  await expect.poll(activeCount).toBe(1);
  const cloudWrite = page.waitForResponse(
    resp =>
      resp.url().includes("/api/dataset/screen-clipboard") &&
      resp.request().method() === "POST"
  );
  await page.getByTestId("free-copy").click();
  const cloudBody = (await (await cloudWrite).json()) as { code: number };
  expect(cloudBody.code).toBe(1000);
  await expect(page.getByText(/已复制 1 个窗格/)).toBeVisible();

  // 抹掉本地剪贴板：后面的插入只可能来自云端槽位
  await page.evaluate(() =>
    Object.keys(localStorage)
      .filter(key => key.endsWith("screen-free-clipboard"))
      .forEach(key => localStorage.removeItem(key))
  );
  await expect(page.getByTestId("free-paste-cloud")).toBeEnabled();
  await page.getByTestId("free-paste-cloud").click();
  await expect.poll(() => paneEls.count()).toBe(3);

  await saveAndWait(page, screen.pk);
  const savedRes = await page.request.get(
    `${BACKEND_URL}/api/dataset/screens/${screen.pk}`,
    { headers: auth(token) }
  );
  const savedData = (await savedRes.json()).data as {
    free_layout: { panes: { pk: string; rotate?: number; type: string }[] };
  };
  expect(savedData.free_layout.panes).toHaveLength(3);
  // 新 pk：云端粘贴走同一条插入链路（不与源窗格共用 pk）
  expect(new Set(savedData.free_layout.panes.map(item => item.pk)).size).toBe(
    3
  );
  // 粘来的那格与复制源同源：共两格带 45° 旋转
  expect(
    savedData.free_layout.panes.filter(item => item.rotate === 45)
  ).toHaveLength(2);

  // ---- 清理：大屏 / 团队模板 / 云端槽位都走 API ----
  await page.request.delete(
    `${BACKEND_URL}/api/dataset/screen-templates/${templatePk}`,
    { headers: auth(token) }
  );
  const slotRes = await page.request.get(
    `${BACKEND_URL}/api/dataset/screen-clipboard?page=1&size=1`,
    { headers: auth(token) }
  );
  const slot = ((await slotRes.json()).data.results ?? [])[0] as
    { pk: string } | undefined;
  if (slot?.pk) {
    await page.request.delete(
      `${BACKEND_URL}/api/dataset/screen-clipboard/${slot.pk}`,
      { headers: auth(token) }
    );
  }
  await page.request.delete(`${BACKEND_URL}/api/dataset/screens/${screen.pk}`, {
    headers: auth(token)
  });
});
