import { expect, test } from "@playwright/test";

import { BACKEND_URL, getAccessToken, login, openMenuPath } from "./helpers";

/**
 * 大屏画布设计器：
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
  // 列表页新建/编辑已迁到框架元数据表单：入口是工具栏默认「新增」按钮
  await expect(
    page.getByRole("button", { name: "新增", exact: true })
  ).toBeVisible({
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

/**
 * 大屏主题：设计器切换 → 保存回显 → 投屏按主题渲染；直开全屏页主题已初始化。
 *
 * 断言口径：
 * - 直开（新标签页整页加载）时 `html[data-theme]` 必须已落（缺陷场景里它缺失，
 *   菜单调色板 / 暗色 / 自定义主色全部回退缺省）；
 * - 主题落到根节点 `data-screen-theme`（深色缺省不挂浅色类，浅色挂类覆写令牌）；
 * - 图表配色随大屏主题（`data-chart-theme`），不受站点明暗污染。
 */
test("大屏主题：直开设计器主题已初始化，切换保存后投屏按主题渲染", async ({
  page
}) => {
  const suffix = Math.random().toString(36).slice(2, 8);
  const screenName = `E2E主题大屏-${suffix}`;

  await login(page);
  const token = await getAccessToken(page);

  const dataset = await postJson(
    page,
    `${BACKEND_URL}/api/dataset/datasets`,
    token,
    {
      name: `E2E主题数据集-${suffix}`,
      bound_model: "identity.userinfo",
      columns: ["username", "gender"],
      visibility: "shared"
    }
  );
  const dashboard = await postJson(
    page,
    `${BACKEND_URL}/api/dataset/dashboards`,
    token,
    {
      name: `E2E主题看板-${suffix}`,
      visibility: "shared",
      layout: [
        {
          id: `card-${suffix}`,
          dataset: dataset.pk,
          title: `主题卡-${suffix}`,
          chart_type: "number",
          metric: "count",
          span: 6
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
      layout: [
        {
          pk: "p1",
          type: "dashboard",
          dashboard: dashboard.pk,
          x: 0,
          y: 0,
          w: 6,
          h: 4
        }
      ],
      visibility: "shared"
    }
  );

  // ---- 直开设计器（整页加载，无 Layout）：主题初始化必须已生效 ----
  await page.goto(`/#/analysis/screen/designer?pk=${screen.pk}`);
  await expect(page.getByTestId("designer-canvas")).toBeVisible({
    timeout: 15_000
  });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const designerRoot = page.locator(".designer-root");
  await expect(designerRoot).toHaveAttribute("data-screen-theme", "dark");

  // ---- 切浅色：根类 + 图表配色同步（所见即所得）----
  await page.getByTestId("designer-theme-light").click();
  await expect(designerRoot).toHaveAttribute("data-screen-theme", "light");
  await expect(designerRoot).toHaveClass(/screen-root--light/);
  await expect(
    designerRoot.locator('[data-chart-theme="light"]').first()
  ).toBeVisible({ timeout: 20_000 });

  // ---- 保存 → 落库 → 重新打开回显 ----
  await page.getByTestId("designer-save").click();
  await expect(page.getByText("画布已保存")).toBeVisible({ timeout: 10_000 });
  const saved = await page.request.get(
    `${BACKEND_URL}/api/dataset/screens/${screen.pk}`,
    { headers: auth(token) }
  );
  expect((await saved.json()).data.theme.value).toBe("light");

  await page.reload();
  await expect(designerRoot).toHaveAttribute("data-screen-theme", "light");
  await expect(
    page.getByTestId("designer-theme-light").locator("input")
  ).toBeChecked();

  // ---- 投屏（直开）：浅色画布 + 浅色图表 ----
  await page.goto(`/#/analysis/screen/display?pk=${screen.pk}`);
  const screenRoot = page.locator(".screen-root");
  await expect(screenRoot).toHaveAttribute("data-screen-theme", "light");
  await expect(screenRoot).toHaveClass(/screen-root--light/);
  await expect(
    screenRoot.locator('[data-chart-theme="light"]').first()
  ).toBeVisible({ timeout: 20_000 });

  // ---- 投屏页本机切换：只影响本机，配置不变（现场临时看深色不改别人的大屏）----
  await page.getByTestId("screen-theme-trigger").click();
  await page.getByTestId("screen-theme-dark").click();
  await expect(screenRoot).toHaveAttribute("data-screen-theme", "dark");
  await expect(
    screenRoot.locator('[data-chart-theme="dark"]').first()
  ).toBeVisible({ timeout: 20_000 });
  const stillLight = await page.request.get(
    `${BACKEND_URL}/api/dataset/screens/${screen.pk}`,
    { headers: auth(token) }
  );
  expect((await stillLight.json()).data.theme.value).toBe("light");

  // 「恢复配置」回到已保存的浅色
  await page.getByTestId("screen-theme-reset").click();
  await expect(screenRoot).toHaveAttribute("data-screen-theme", "light");

  // 「保存为默认」：本机切换固化到服务端，并撤掉本机覆盖
  await page.getByTestId("screen-theme-dark").click();
  await page.getByTestId("screen-theme-save").click();
  await expect(page.getByText("主题已保存")).toBeVisible({ timeout: 10_000 });
  await expect(screenRoot).toHaveAttribute("data-screen-theme", "dark");
  const savedDark = await page.request.get(
    `${BACKEND_URL}/api/dataset/screens/${screen.pk}`,
    { headers: auth(token) }
  );
  expect((await savedDark.json()).data.theme.value).toBe("dark");

  // ---- 独立主题色：投屏按主题色覆写主色 ----
  const patched = await page.request.patch(
    `${BACKEND_URL}/api/dataset/screens/${screen.pk}`,
    { headers: auth(token), data: { theme_color: "#FF0000" } }
  );
  expect((await patched.json()).code).toBe(1000);
  await page.reload();
  await expect(screenRoot).not.toHaveClass(/screen-root--light/);
  expect(
    await screenRoot.evaluate(el => el.style.getPropertyValue("--primary"))
  ).not.toBe("");

  // ---- 跟随站点：生效明暗与站点 html.dark 一致 ----
  await page.request.patch(`${BACKEND_URL}/api/dataset/screens/${screen.pk}`, {
    headers: auth(token),
    data: { theme: "auto" }
  });
  await page.reload();
  const siteDark = await page.evaluate(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light"
  );
  await expect(screenRoot).toHaveAttribute("data-screen-theme", siteDark);

  // ---- 返回入口：投屏页可回到大屏列表（此前只能改地址栏）----
  await page.getByTestId("screen-back").click();
  await expect(page).toHaveURL(/\/analysis\/screen\/index/);
  await expect(
    page.getByRole("button", { name: "新增", exact: true })
  ).toBeVisible({ timeout: 15_000 });

  await page.request
    .delete(
      `${BACKEND_URL}/api/dataset/screens/${screen.pk}?impact_confirmed=true`,
      { headers: auth(token) }
    )
    .catch(() => undefined);
});
