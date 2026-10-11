import { expect, test } from "@playwright/test";

import { BACKEND_URL, getAccessToken, login, openMenuPath } from "./helpers";

/**
 * 大屏画布工具集三期（ADR-088）：窗格旋转 / 入场动画 / 富文本 / 元素级网格吸附 /
 * zoom 键盘档位 / 团队模板（另存 + 应用 + 删除）/ 模板 JSON 导入 / 多选批量改属性。
 *
 * 素材走 API 直建（数据集 / 看板主链路已由别的用例覆盖）；断言两层：DOM 证交互效果
 * （transform / v-html / 动画类名 / data-zoom），保存后读接口证落库结果
 * （rotate / animation / text_format / 网格坐标 / 模板载荷）。
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

test("画布工具集三期：旋转 / 动画 / 富文本 / 网格吸附 / 键盘档位 / 团队模板 / JSON 导入", async ({
  page
}) => {
  const suffix = Math.random().toString(36).slice(2, 8);
  const screenName = `E2E工具集三期-${suffix}`;
  const templateName = `E2E团队模板-${suffix}`;

  await login(page);
  const token = await getAccessToken(page);
  const screen = await postJson(
    page,
    `${BACKEND_URL}/api/dataset/screens`,
    token,
    { name: screenName, dashboards: [], layout: [], visibility: "shared" }
  );

  // ---- 进设计器并切到自由画布 ----
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
  const fitted = await zoomOf();

  // ---- 富文本 + 旋转 + 入场动画（属性面板三连）----
  await page.getByTestId("palette-text").click();
  await expect(paneEls).toHaveCount(1);
  await page.getByTestId("inspector-text-format").getByText("富文本").click();
  await page
    .getByTestId("inspector-text")
    .fill("**加粗标题** 与 [c=#f00]彩字[/c]");
  const paneText = freeCanvas.getByTestId("pane-text");
  await expect(paneText.locator("strong")).toHaveText("加粗标题");
  // 颜色 span 带内联样式；窗格内的操作按钮也渲染 span，故按属性定位
  await expect(paneText.locator('span[style*="color"]')).toHaveText("彩字");

  const rotateInput = page.getByTestId("inspector-rotate").locator("input");
  await rotateInput.fill("45");
  await rotateInput.press("Enter");
  const pane = paneEls.first();
  await expect(pane.locator(".screen-pane")).toHaveAttribute(
    "style",
    /rotate\(45deg\)/
  );

  await page.getByTestId("inspector-animation").click();
  await page
    .locator(".el-select-dropdown__item")
    .filter({ hasText: "淡入" })
    .first()
    .click();
  // 编辑态不播（类名不挂）：data 属性记录配置，预览态才挂动画类
  await expect(pane.locator(".screen-pane")).toHaveAttribute(
    "data-pane-animation",
    "fade"
  );
  await expect(pane.locator(".screen-pane")).not.toHaveClass(
    /pane-animation--fade/
  );
  await page.getByTestId("designer-preview").click();
  await expect(
    freeCanvas.locator(".screen-pane.pane-animation--fade")
  ).toHaveCount(1);
  await page.getByTestId("designer-preview").click();

  // ---- 元素级网格吸附：开开关 + 步长 20，拖动后坐标必须是步长倍数 ----
  await page.getByTestId("free-grid-snap").click();
  await page.getByTestId("free-grid-step").click();
  await page
    .locator(".el-select-dropdown__item")
    .filter({ hasText: "20px" })
    .first()
    .click();
  const before = (await pane.boundingBox())!;
  await page.mouse.move(before.x + 60, before.y + 20);
  await page.mouse.down();
  await page.mouse.move(before.x + 173, before.y + 111, { steps: 10 });
  await page.mouse.up();
  const moved = (await pane.boundingBox())!;
  expect(Math.abs(moved.x - before.x)).toBeGreaterThan(10);

  await saveAndWait(page, screen.pk);
  const saved = await page.request.get(
    `${BACKEND_URL}/api/dataset/screens/${screen.pk}`,
    { headers: auth(token) }
  );
  const savedData = (await saved.json()).data as {
    layout_mode: { value: string };
    free_layout: { design_w: number; panes: Record<string, unknown>[] };
  };
  expect(savedData.layout_mode.value).toBe("free");
  const savedPane = savedData.free_layout.panes[0] as {
    rotate: number;
    animation: string;
    text_format: string;
    x: number;
    y: number;
    text: string;
  };
  expect(savedPane.rotate).toBe(45);
  expect(savedPane.animation).toBe("fade");
  expect(savedPane.text_format).toBe("rich");
  expect(savedPane.text).toContain("**加粗标题**");
  // 网格吸附：坐标落在 20px 的倍数上（参考线命中的目标线也是步长倍数）
  expect(savedPane.x % 20).toBe(0);
  expect(savedPane.y % 20).toBe(0);

  // ---- zoom 键盘档位：⌘/Ctrl + = / - 步进、⌘/Ctrl + 0 适应窗口 ----
  await page.keyboard.press("Control+=");
  const zoomed = await zoomOf();
  expect(zoomed).toBeGreaterThan(fitted);
  // 档位步进（不是「回上一档」栈）：0.5 的下一档 = 0.25
  await page.keyboard.press("Control+-");
  expect(await zoomOf()).toBeLessThan(zoomed);
  // ⌘/Ctrl + 0 = 适应窗口（回到进设计器时的实测比例）
  await page.keyboard.press("Control+0");
  expect(await zoomOf()).toBeCloseTo(fitted, 2);

  // ---- 团队模板：另存（名称 + 可见性）→ 列表可见 → 追加应用 ----
  await page.getByTestId("free-template-save-server").click();
  await page.locator(".el-message-box input").last().fill(templateName);
  await clickBoxButton(page, "保存为模板");
  await clickBoxButton(page, "团队共享");
  await expect(page.getByText(/已保存为团队模板/)).toBeVisible();
  const templates = await page.request.get(
    `${BACKEND_URL}/api/dataset/screen-templates`,
    { headers: auth(token) }
  );
  const templateRows = (await templates.json()).data.results as {
    pk: string;
    name: string;
    free_layout: { panes: { rotate?: number }[] };
  }[];
  const created = templateRows.find(item => item.name === templateName);
  expect(created).toBeTruthy();
  expect(created?.free_layout.panes[0].rotate).toBe(45);

  await page.getByTestId("free-template-menu").click();
  await page
    .locator(".el-dropdown-menu__item")
    .filter({ hasText: `追加应用 · ${templateName}` })
    .first()
    .click();
  await expect(page.getByText(/已应用模板/)).toBeVisible();
  await expect(paneEls).toHaveCount(2);

  // ---- 模板 JSON 导入（追加：替换会把上面的窗格冲掉）----
  await page.getByTestId("free-template-import-input").setInputFiles({
    name: "template.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        name: "导入模板",
        design: { design_w: 1920, design_h: 1080 },
        panes: [
          {
            pk: "imp-1",
            type: "text",
            x: 120,
            y: 900,
            w: 600,
            h: 80,
            text: "导入文本",
            size: 32,
            align: "left"
          }
        ]
      })
    )
  });
  await clickBoxButton(page, "追加应用");
  await expect(page.getByText(/已导入 1 个窗格/)).toBeVisible();
  await expect(freeCanvas.getByText("导入文本")).toBeVisible();
  await expect(paneEls).toHaveCount(3);

  await saveAndWait(page, screen.pk);
  const afterImport = await page.request.get(
    `${BACKEND_URL}/api/dataset/screens/${screen.pk}`,
    { headers: auth(token) }
  );
  const imported = (await afterImport.json()).data as {
    free_layout: { panes: { text?: string; pk: string }[] };
  };
  expect(imported.free_layout.panes).toHaveLength(3);
  expect(
    imported.free_layout.panes.some(item => item.text === "导入文本")
  ).toBe(true);

  // ---- 多选批量改属性：统一值语义（不适用的窗格跳过）----
  await page.keyboard.press("Control+a");
  await expect(page.getByTestId("multi-count")).toContainText("3");
  await expect(page.getByTestId("multi-batch")).toBeVisible();
  // 三格都是文本：字号 / 文本格式 / 对齐三个控件都在；图片填充（无图片窗格）不出现
  await expect(page.getByTestId("batch-fit")).toHaveCount(0);
  const batchSize = page.getByTestId("batch-size").locator("input");
  await batchSize.fill("48");
  await batchSize.press("Enter");
  const batchRotate = page.getByTestId("batch-rotate").locator("input");
  await batchRotate.fill("30");
  await batchRotate.press("Enter");
  await page.getByTestId("batch-text-format").getByText("纯文本").click();
  // 公共值回显：三格一致后控件显示该值（多值不一时为空）
  await expect(batchSize).toHaveValue("48");
  await expect(batchRotate).toHaveValue("30");

  await saveAndWait(page, screen.pk);
  const afterBatch = await page.request.get(
    `${BACKEND_URL}/api/dataset/screens/${screen.pk}`,
    { headers: auth(token) }
  );
  const batchData = (await afterBatch.json()).data as {
    free_layout: {
      panes: { size?: number; rotate?: number; text_format?: string }[];
    };
  };
  // 统一值：三格全部被改写（含此前旋转 45 的那一格），文本格式回到 plain 后不下发
  expect(batchData.free_layout.panes).toHaveLength(3);
  for (const item of batchData.free_layout.panes) {
    expect(item.size).toBe(48);
    expect(item.rotate).toBe(30);
    expect(item.text_format).toBeUndefined();
  }

  // ---- 团队模板删除（管理入口，创建者本人可删）----
  await page.getByTestId("free-template-manage").click();
  await page
    .locator(".el-dropdown-menu__item")
    .filter({ hasText: `删除 · ${templateName}` })
    .first()
    .click();
  await clickBoxButton(page, "确定");
  await expect(page.getByText(/模板已删除/)).toBeVisible();
  const afterDelete = await page.request.get(
    `${BACKEND_URL}/api/dataset/screen-templates`,
    { headers: auth(token) }
  );
  const leftRows = (await afterDelete.json()).data.results as {
    name: string;
  }[];
  expect(leftRows.some(item => item.name === templateName)).toBe(false);

  // 清理大屏（素材由 API 直建，走 API 删除保持与其它用例一致）
  await page.request.delete(`${BACKEND_URL}/api/dataset/screens/${screen.pk}`, {
    headers: auth(token)
  });
});
