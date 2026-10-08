import { expect, test } from "@playwright/test";

import { BACKEND_URL, getAccessToken, login, openMenuPath } from "./helpers";

/**
 * 大屏画布设计器（P2.2 批次一）：
 * 素材走 API 直建（数据集 → 看板 1 张卡 → 大屏），UI 覆盖设计器主链路
 * （加时钟/文本/仪表盘窗格 → 拖动 → 保存落库），最后投屏断言画布渲染
 * （layout 非空走画布、清空则回退轮播，轮播由 visual.e2e 覆盖）。
 *
 * 素材为什么走 API：E2E 种子只跑 init_data（无演示看板），而数据集/看板的建表
 * 主链路已由 analysis.e2e 覆盖，此处再点一遍只会拉长跑批。
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

test("大屏设计器：加窗格 → 拖动 → 保存 → 投屏按画布渲染", async ({ page }) => {
  const suffix = Math.random().toString(36).slice(2, 8);
  const cardTitle = `E2E看板卡-${suffix}`;
  const screenName = `E2E设计器大屏-${suffix}`;
  const paneText = `画布标题-${suffix}`;

  await login(page);
  const token = await getAccessToken(page);

  // ---- 素材：数据集 → 看板（1 张指标卡）→ 大屏（轮播字段并存） ----
  const dataset = await postJson(
    page,
    `${BACKEND_URL}/api/dataset/datasets`,
    token,
    {
      name: `E2E设计器数据集-${suffix}`,
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
      name: `E2E设计器看板-${suffix}`,
      visibility: "shared",
      layout: [
        {
          id: `card-${suffix}`,
          dataset: dataset.pk,
          title: cardTitle,
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

  // ---- 进设计器 ----
  await openMenuPath(page, ["数据分析"], "/analysis/screen/index");
  const row = page.getByRole("row", { name: screenName });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button", { name: "设计" }).click();
  await expect(page).toHaveURL(/\/analysis\/screen\/designer/);
  const canvas = page.getByTestId("designer-canvas");
  await expect(canvas).toBeVisible({ timeout: 15_000 });

  // ---- 时钟窗格：默认 3×2，内容为秒级时钟 ----
  await page.getByTestId("palette-clock").click();
  const clockPane = canvas.locator('[data-pane-type="clock"]');
  await expect(clockPane).toHaveCount(1);
  await expect(clockPane.getByTestId("pane-clock")).toHaveText(
    /\d{2}:\d{2}:\d{2}/
  );

  // ---- 文本窗格：属性面板写内容 ----
  await page.getByTestId("palette-text").click();
  const textPane = canvas.locator('[data-pane-type="text"]');
  await textPane.click();
  await page.getByTestId("inspector-text").fill(paneText);
  await expect(textPane.getByTestId("pane-text")).toHaveText(paneText);

  // ---- 仪表盘窗格：内嵌该看板卡片（图表按主题渲染）----
  await page
    .getByTestId("palette-dashboard")
    .filter({ hasText: `E2E设计器看板-${suffix}` })
    .first()
    .click();
  const dashboardPane = canvas.locator('[data-pane-type="dashboard"]');
  await expect(dashboardPane).toHaveCount(1);
  await expect(dashboardPane.getByText(cardTitle).first()).toBeVisible({
    timeout: 20_000
  });

  // ---- 拖动：时钟窗格右移若干格，位次样式随之变化 ----
  const before = await clockPane.getAttribute("style");
  const grip = clockPane.getByTestId("pane-drag");
  const box = (await grip.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 220, box.y + box.height / 2, {
    steps: 8
  });
  await page.mouse.up();
  await expect(clockPane).not.toHaveAttribute("style", before!);

  // ---- 保存：提示 + 未保存标记消失 + 落库校验（读接口）----
  await page.getByTestId("designer-save").click();
  await expect(page.getByText("画布已保存")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".designer-header .el-tag")).toHaveCount(0);

  const saved = await page.request.get(
    `${BACKEND_URL}/api/dataset/screens/${screen.pk}`,
    { headers: auth(token) }
  );
  const panes = (await saved.json()).data.layout as {
    type: string;
    x: number;
  }[];
  expect(panes.map(pane => pane.type).sort()).toEqual([
    "clock",
    "dashboard",
    "text"
  ]);
  expect(panes.find(pane => pane.type === "clock")!.x).toBeGreaterThan(0);

  // ---- 投屏：画布渲染（无轮播页码/暂停控件）----
  await page.goto(`/#/analysis/screen/index`);
  await expect(page.getByRole("button", { name: "新建大屏" })).toBeVisible({
    timeout: 15_000
  });
  await page
    .getByRole("row", { name: screenName })
    .getByRole("button", {
      name: "投屏"
    })
    .click();
  const screenRoot = page.locator(".screen-root");
  await expect(screenRoot.getByTestId("screen-canvas")).toBeVisible({
    timeout: 15_000
  });
  await expect(screenRoot.getByText(paneText)).toBeVisible();
  await expect(screenRoot.getByText(cardTitle).first()).toBeVisible({
    timeout: 20_000
  });
  await expect(screenRoot.locator(".screen-page")).toHaveCount(0);
  await expect(screenRoot.getByTestId("screen-pause")).toHaveCount(0);

  // ---- 清理：走 API（带 impact_confirmed；UI 删除链路由 impact-preview.e2e 覆盖）----
  await page.request
    .delete(
      `${BACKEND_URL}/api/dataset/screens/${screen.pk}?impact_confirmed=true`,
      { headers: auth(token) }
    )
    .catch(() => undefined);
});
