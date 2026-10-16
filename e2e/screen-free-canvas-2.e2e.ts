import { expect, test } from "@playwright/test";

import { BACKEND_URL, getAccessToken, login, openMenuPath } from "./helpers";

/**
 * 大屏自由画布二期（编辑效率）：显示缩放（档位 / 适应窗口 / Ctrl+滚轮锚点缩放）、
 * 框选多选 + 对齐、组拖动、Ctrl+C/V 剪贴板粘贴、模板应用（替换 + 二次确认）。
 *
 * 素材走 API 直建（与一期 spec 同口径：数据集 / 看板主链路已由别的用例覆盖），
 * 断言以「DOM 几何 + 保存后读接口」两层落地：DOM 证交互效果，接口证落库结果。
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

test("自由画布二期：缩放 → 框选对齐 → 组拖动 → 复制粘贴 → 套用模板", async ({
  page
}) => {
  const suffix = Math.random().toString(36).slice(2, 8);
  const screenName = `E2E自由二期-${suffix}`;

  await login(page);
  const token = await getAccessToken(page);

  const dataset = await postJson(
    page,
    `${BACKEND_URL}/api/dataset/datasets`,
    token,
    {
      name: `E2E二期数据集-${suffix}`,
      bound_model: "identity.userinfo",
      columns: ["username", "nickname", "gender", "is_active"],
      visibility: "shared"
    }
  );
  const dashboard = await postJson(
    page,
    `${BACKEND_URL}/api/dataset/dashboards`,
    token,
    {
      name: `E2E二期看板-${suffix}`,
      visibility: "shared",
      layout: [
        {
          id: `card-${suffix}`,
          dataset: dataset.pk,
          title: `E2E二期卡-${suffix}`,
          chart_type: "number",
          metric: "count",
          span: 3
        }
      ]
    }
  );
  const screen = await postJson(
    page,
    `${BACKEND_URL}/api/dataset/screens`,
    token,
    {
      name: screenName,
      dashboards: [dashboard.pk],
      layout: [],
      visibility: "shared"
    }
  );

  // ---- 进设计器 → 自由画布 ----
  await openMenuPath(page, ["数据分析"], "/analysis/screen/index");
  const row = page.getByRole("row", { name: screenName });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button", { name: "设计" }).click();
  await expect(page).toHaveURL(/\/analysis\/screen\/designer/);
  await expect(page.getByTestId("designer-canvas")).toBeVisible({
    timeout: 15_000
  });
  await page.getByTestId("designer-mode-free").click();
  const freeCanvas = page.getByTestId("free-canvas");
  const stage = page.getByTestId("free-stage");
  await expect(freeCanvas).toBeVisible();

  const zoomOf = async () => Number(await stage.getAttribute("data-zoom"));

  // ---- 显示缩放：适应窗口 → 100% → Ctrl+滚轮（指针锚点）----
  const fitted = await zoomOf();
  expect(fitted).toBeGreaterThan(0);
  expect(fitted).toBeLessThanOrEqual(1);

  await page.getByTestId("free-zoom-100").click();
  expect(await zoomOf()).toBe(1);

  // 档位下拉：与滚轮共用同一份夹取口径（25%~200%）
  await page.getByTestId("free-zoom-select").click();
  await page.getByRole("option", { name: "50%", exact: true }).click();
  expect(await zoomOf()).toBe(0.5);
  await page.getByTestId("free-zoom-select").click();
  await page.getByRole("option", { name: "125%", exact: true }).click();
  expect(await zoomOf()).toBe(1.25);
  await page.getByTestId("free-zoom-100").click();
  expect(await zoomOf()).toBe(1);

  const wrap = page.getByTestId("free-canvas-wrap");
  // 滚轮坐标必须落在视口内：锚点缩放会按指针位置补偿滚动量，
  // 坐标缺省（clientX=0）等于「在容器外滚轮」，会把画布左上角滚出可视区
  const wrapBox = (await wrap.boundingBox())!;
  const wheelAt = {
    clientX: wrapBox.x + wrapBox.width / 2,
    clientY: wrapBox.y + wrapBox.height / 2,
    bubbles: true,
    cancelable: true
  };
  const scrollOf = () =>
    wrap.evaluate(el => `${el.scrollLeft},${el.scrollTop}`);

  await wrap.dispatchEvent("wheel", {
    ...wheelAt,
    deltaY: -120,
    ctrlKey: true
  });
  expect(await zoomOf()).toBe(1.25);
  await wrap.dispatchEvent("wheel", { ...wheelAt, deltaY: 120, ctrlKey: true });
  expect(await zoomOf()).toBe(1);
  // 指针锚点：放大再缩回后滚动量回到原处（同一数据点没跑）
  expect(await scrollOf()).toBe("0,0");
  // 普通滚轮不改缩放（交给容器滚动）
  await wrap.dispatchEvent("wheel", { ...wheelAt, deltaY: -120 });
  expect(await zoomOf()).toBe(1);

  // ---- 三个文本窗格（层叠落点：80 / 104 / 128）----
  for (let index = 0; index < 3; index++) {
    await page.getByTestId("palette-text").click();
  }
  const paneEls = freeCanvas.locator(".re-resize");
  await expect(paneEls).toHaveCount(3);

  // ---- 框选：从画布左上角空白拖到中部（覆盖三个窗格）----
  const canvasBox = (await freeCanvas.boundingBox())!;
  await page.mouse.move(canvasBox.x + 4, canvasBox.y + 4);
  await page.mouse.down();
  await page.mouse.move(
    canvasBox.x + canvasBox.width * 0.5,
    canvasBox.y + canvasBox.height * 0.5,
    { steps: 8 }
  );
  await expect(page.getByTestId("free-marquee")).toBeVisible();
  await page.mouse.up();
  await expect(page.getByTestId("multi-selection")).toBeVisible();
  await expect(page.getByTestId("multi-count")).toContainText("3");

  // ---- 对齐：左对齐 / 顶对齐（多选基准 = 选区包围盒）----
  const boxes = async () =>
    Promise.all(
      (await paneEls.all()).map(async el => (await el.boundingBox())!)
    );
  const spread = (values: number[]) =>
    Math.max(...values) - Math.min(...values);

  // ---- 分布：先单选一个窗格用键盘撑开（Shift+方向 = 10px/步），再整组垂直等间距 ----
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("multi-selection")).toHaveCount(0);
  const third = (await boxes())[2];
  await page.mouse.click(third.x + third.width / 2, third.y + third.height / 2);
  for (let index = 0; index < 30; index++) {
    await page.keyboard.press("Shift+ArrowDown");
  }
  await page.keyboard.press("Control+a");
  await expect(page.getByTestId("multi-count")).toContainText("3");
  await page.getByTestId("distribute-v").click();
  // 三段等距：首尾不动、中间均分边距（窗格等高 ⇒ 相邻起点差值一致）
  const distributed = (await boxes()).map(box => box.y).sort((a, b) => a - b);
  const gapTop = distributed[1] - distributed[0];
  const gapBottom = distributed[2] - distributed[1];
  expect(Math.abs(gapTop - gapBottom)).toBeLessThanOrEqual(2);
  expect(distributed[2] - distributed[0]).toBeGreaterThan(100);

  await page.getByTestId("align-left").click();
  expect(spread((await boxes()).map(box => box.x))).toBeLessThan(2);
  await page.getByTestId("align-top").click();
  expect(spread((await boxes()).map(box => box.y))).toBeLessThan(2);

  // ---- 组拖动：拖动其中一个窗格，整组同幅位移 ----
  const before = await boxes();
  const first = before[0];
  await page.mouse.move(first.x + 30, first.y + 10);
  await page.mouse.down();
  await page.mouse.move(first.x + 130, first.y + 70, { steps: 10 });
  await page.mouse.up();
  const after = await boxes();
  const deltas = after.map((box, index) => ({
    dx: Math.round(box.x - before[index].x),
    dy: Math.round(box.y - before[index].y)
  }));
  // 三个窗格位移一致（组刚性移动；被拖窗格吸附后可能差 1px 内）
  for (const delta of deltas) {
    expect(Math.abs(delta.dx - deltas[0].dx)).toBeLessThanOrEqual(2);
    expect(Math.abs(delta.dy - deltas[0].dy)).toBeLessThanOrEqual(2);
  }
  expect(Math.abs(deltas[0].dx) + Math.abs(deltas[0].dy)).toBeGreaterThan(20);

  // ---- 复制粘贴：Ctrl+C / Ctrl+V（整组，粘贴后选中新窗格）----
  await page.keyboard.press("Control+c");
  await expect(page.getByText(/已复制 3 个窗格/)).toBeVisible();
  await page.keyboard.press("Control+v");
  await expect(paneEls).toHaveCount(6);
  await expect(page.getByTestId("multi-count")).toContainText("3");

  await saveAndWait(page, screen.pk);
  const savedFree = await page.request.get(
    `${BACKEND_URL}/api/dataset/screens/${screen.pk}`,
    { headers: auth(token) }
  );
  const savedData = (await savedFree.json()).data as {
    layout_mode: { value: string };
    free_layout: { design_w: number; panes: { pk: string }[] };
  };
  expect(savedData.layout_mode.value).toBe("free");
  expect(savedData.free_layout.design_w).toBe(1920);
  expect(savedData.free_layout.panes).toHaveLength(6);
  const savedPks = savedData.free_layout.panes.map(pane => pane.pk);
  expect(new Set(savedPks).size).toBe(6);

  // ---- 模板：替换应用内置「宣传屏」（二次确认）----
  await page.getByTestId("free-template-menu").click();
  await page
    .locator(".el-dropdown-menu__item")
    .filter({ hasText: "替换应用" })
    .first()
    .click();
  const confirmBox = page.locator(".el-message-box");
  await expect(confirmBox).toBeVisible();
  await confirmBox.getByRole("button", { name: "替换应用" }).click();
  await expect(page.getByText(/已应用模板/)).toBeVisible();
  await expect(paneEls).toHaveCount(3);
  // 精确匹配：宣传屏另有「副标题 / 说明」，子串匹配会撞上两个元素
  await expect(freeCanvas.getByText("标题", { exact: true })).toBeVisible();

  await saveAndWait(page, screen.pk);
  const afterTemplate = await page.request.get(
    `${BACKEND_URL}/api/dataset/screens/${screen.pk}`,
    { headers: auth(token) }
  );
  const templateData = (await afterTemplate.json()).data as {
    layout_mode: { value: string };
    free_layout: { panes: { type: string }[] };
  };
  expect(templateData.free_layout.panes.map(pane => pane.type).sort()).toEqual([
    "clock",
    "text",
    "text"
  ]);
  expect(templateData.layout_mode.value).toBe("free");

  // ---- 清理：走 API（带 impact_confirmed）----
  await page.request
    .delete(
      `${BACKEND_URL}/api/dataset/screens/${screen.pk}?impact_confirmed=true`,
      { headers: auth(token) }
    )
    .catch(() => undefined);
});
