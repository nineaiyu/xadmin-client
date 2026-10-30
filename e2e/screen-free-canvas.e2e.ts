import { expect, test } from "@playwright/test";

import { BACKEND_URL, getAccessToken, login, openMenuPath } from "./helpers";

/**
 * 大屏自由画布（像素级自由排版）：
 * 设计器切「自由画布」→ 加窗格 → 拖动/缩放（吸附参考线 + 画幅边界夹回）→ 保存
 * （只写 layout_mode + free_layout，栅格载荷保留）→ 投屏按设计画幅等比缩放渲染
 * → 切回栅格再保存（两套载荷互不转换）。
 *
 * 素材走 API 直建（与 screen-designer.e2e 同口径：数据集/看板主链路已由别的用例覆盖）。
 */

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/**
 * 点保存并等这一次 PATCH 真正返回（不能只断言成功提示：轻量流程里上一次保存的
 * 提示可能仍在屏（ElMessage 3s 存活），断言会被旧提示打穿，随后的读接口会读到
 * 保存前的状态）。
 */
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

test("自由画布：拖动缩放保存 → 投屏等比缩放；切回栅格不转换坐标", async ({
  page
}) => {
  const suffix = Math.random().toString(36).slice(2, 8);
  const screenName = `E2E自由大屏-${suffix}`;
  const paneText = `自由标题-${suffix}`;

  await login(page);
  const token = await getAccessToken(page);

  // ---- 素材：数据集 → 看板（1 张指标卡）→ 大屏 ----
  const dataset = await postJson(
    page,
    `${BACKEND_URL}/api/dataset/datasets`,
    token,
    {
      name: `E2E自由数据集-${suffix}`,
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
      name: `E2E自由看板-${suffix}`,
      visibility: "shared",
      layout: [
        {
          id: `card-${suffix}`,
          dataset: dataset.pk,
          title: `E2E自由卡-${suffix}`,
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

  // ---- 进设计器并切到自由画布 ----
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
  await expect(freeCanvas).toBeVisible();

  // ---- 文本窗格：属性面板写内容（像素定位，属性面板显示 px 语义提示）----
  await page.getByTestId("palette-text").click();
  const textPane = freeCanvas.locator('[data-pane-type="text"]');
  await expect(textPane).toHaveCount(1);
  await textPane.click();
  await page.getByTestId("inspector-text").fill(paneText);
  await expect(textPane.getByTestId("pane-text")).toHaveText(paneText);
  await expect(page.getByTestId("inspector-layer-top")).toBeVisible();

  // ---- 拖动：整块可拖（自由模式无栅格抓手），按住窗格左移到画幅边界 ----
  const paneBox = (await textPane.boundingBox())!;
  await page.mouse.move(paneBox.x + paneBox.width / 2, paneBox.y + 20);
  await page.mouse.down();
  await page.mouse.move(paneBox.x - 240, paneBox.y + 20, { steps: 10 });
  // 拖到画幅左边界：吸附参考线（画幅边界）命中并绘制
  await expect(page.getByTestId("free-guide").first()).toBeVisible();
  await page.mouse.up();
  // 手势结束参考线清空（只提示不残留）
  await expect(page.getByTestId("free-guide")).toHaveCount(0);
  const movedBox = (await textPane.boundingBox())!;
  expect(movedBox.x).toBeLessThan(paneBox.x);

  // ---- 缩放：右下角手柄放大（八向手柄来自 ReResize）----
  // 取手柄中心（不依赖手柄像素尺寸）：手柄自 按 1/z 反缩放做「屏幕尺寸恒定」，
  // 但写死偏移量在任意缩放下都脆弱，取中心对两种口径都稳
  const resizeHandle = freeCanvas.locator(".re-resize__stick--br").first();
  const handleBox = (await resizeHandle.boundingBox())!;
  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 124, handleBox.y + 84, { steps: 10 });
  await page.mouse.up();
  const resizedBox = (await textPane.boundingBox())!;
  expect(resizedBox.width).toBeGreaterThan(movedBox.width);
  expect(resizedBox.height).toBeGreaterThan(movedBox.height);

  // ---- 保存：只写 layout_mode + free_layout（栅格载荷保持为空）----
  await saveAndWait(page, screen.pk);
  await expect(page.getByText("画布已保存")).toBeVisible({ timeout: 10_000 });

  const saved = await page.request.get(
    `${BACKEND_URL}/api/dataset/screens/${screen.pk}`,
    { headers: auth(token) }
  );
  const savedData = (await saved.json()).data as {
    layout: { type: string }[];
    layout_mode: { value: string };
    free_layout: {
      design_w: number;
      design_h: number;
      panes: { type: string; x: number; y: number; w: number; h: number }[];
    };
  };
  expect(savedData.layout_mode.value).toBe("free");
  expect(savedData.free_layout.design_w).toBe(1920);
  expect(savedData.free_layout.design_h).toBe(1080);
  expect(savedData.free_layout.panes.map(pane => pane.type)).toEqual(["text"]);
  const savedPane = savedData.free_layout.panes[0];
  expect(savedPane.x).toBe(0);
  expect(savedPane.y).toBeGreaterThanOrEqual(0);
  expect(savedPane.w).toBeGreaterThanOrEqual(16);
  expect(savedData.layout).toEqual([]);

  // ---- 投屏：按设计画幅等比缩放（transform 为单位比例矩阵，字与间距同缩）----
  await page.goto(`/#/analysis/screen/index`);
  // 列表页新建/编辑已迁到框架元数据表单：入口是工具栏默认「新增」按钮
  await expect(
    page.getByRole("button", { name: "新增", exact: true })
  ).toBeVisible({
    timeout: 15_000
  });
  await page
    .getByRole("row", { name: screenName })
    .getByRole("button", { name: "投屏" })
    .click();
  const screenRoot = page.locator(".screen-root");
  await expect(screenRoot.getByTestId("screen-free")).toBeVisible({
    timeout: 15_000
  });
  await expect(screenRoot.getByText(paneText)).toBeVisible();
  await expect(screenRoot.locator(".screen-page")).toHaveCount(0);
  await expect(screenRoot.getByTestId("screen-pause")).toHaveCount(0);

  const stage = screenRoot.getByTestId("screen-free-stage");
  const matrix = (await stage.evaluate(el => getComputedStyle(el).transform))
    .replace(/^matrix\(|\)$/g, "")
    .split(",")
    .map(Number);
  expect(matrix[0]).toBeGreaterThan(0);
  expect(matrix[0]).toBeLessThanOrEqual(1);
  expect(matrix[1]).toBe(0);
  expect(matrix[2]).toBe(0);
  expect(matrix[3]).toBe(matrix[0]);

  // ---- 几何断言：投屏窗格按 x/y/w/h 定位（与设计器同源包裹层），不再铺满舞台互相覆盖 ----
  const displayDetail = await page.request.get(
    `${BACKEND_URL}/api/dataset/screens/${screen.pk}`,
    { headers: auth(token) }
  );
  const displayPanes = (
    (await displayDetail.json()).data as {
      free_layout: {
        panes: Array<{
          pk: string;
          x: number;
          y: number;
          w: number;
          h: number;
        }>;
      };
    }
  ).free_layout.panes;
  expect(displayPanes.length).toBeGreaterThan(0);
  const stageBox = (await stage.boundingBox())!;
  const k = matrix[0];
  for (const pane of displayPanes) {
    const paneBox = await screenRoot
      .getByTestId(`screen-free-pane-box-${pane.pk}`)
      .boundingBox();
    expect(paneBox).not.toBeNull();
    expect(paneBox!.width).toBeCloseTo(pane.w * k, 0);
    expect(paneBox!.height).toBeCloseTo(pane.h * k, 0);
    expect(paneBox!.x).toBeCloseTo(stageBox.x + pane.x * k, 0);
    expect(paneBox!.y).toBeCloseTo(stageBox.y + pane.y * k, 0);
  }

  // ---- 切回栅格再保存：坐标不互转，自由载荷原样保留 ----
  await page.goto(`/#/analysis/screen/designer?pk=${screen.pk}`);
  await expect(page.getByTestId("free-canvas")).toBeVisible({
    timeout: 15_000
  });
  await page.getByTestId("designer-mode-grid").click();
  await expect(page.getByTestId("designer-canvas")).toBeVisible();
  await expect(page.getByTestId("free-canvas")).toHaveCount(0);
  await saveAndWait(page, screen.pk);

  const afterModeSwitch = await page.request.get(
    `${BACKEND_URL}/api/dataset/screens/${screen.pk}`,
    { headers: auth(token) }
  );
  const switched = (await afterModeSwitch.json()).data as {
    layout_mode: { value: string };
    free_layout: { panes: unknown[] };
  };
  expect(switched.layout_mode.value).toBe("grid");
  expect(switched.free_layout.panes).toHaveLength(1);

  // ---- 清理：走 API（带 impact_confirmed，删除链路由 impact-preview.e2e 覆盖）----
  await page.request
    .delete(
      `${BACKEND_URL}/api/dataset/screens/${screen.pk}?impact_confirmed=true`,
      { headers: auth(token) }
    )
    .catch(() => undefined);
});
