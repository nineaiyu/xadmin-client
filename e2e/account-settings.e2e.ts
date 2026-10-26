import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/**
 * 账户设置（个人中心）：页签与安全日志。
 *
 * 覆盖两个真实缺陷的回归：
 * 1. 页签刷新保持——切换页签后刷新必须停留在同一页签（切换经 history.replaceState
 *    写入 `?tab=`，不触发路由导航，面板首屏请求不被 afterEach 取消链路中止）；
 * 2. 安全日志搜索区——filterset 缺失时页面只有「搜索」按钮没有字段（search-fields
 *    为空），修复后搜索区渲染登录状态 / 方式 / 来源等筛选控件。
 * 3. 布局插件注册幂等——账户设置是无布局页面（`showLink: false`），往返会重建布局
 *    组件，布局 setup 里重复 `app.use` 会命中 Vue 的「Plugin has already been
 *    applied to target app」告警。
 * 4. 无布局页自足——vue-tippy 指令与离线图标集都挂在布局 setup 里，本页不套布局，
 *    页内 RePlusPage / 表格栏按钮（JSX 的 `v-tippy`）与空态图标（`ep/box`）曾分别
 *    报「Failed to resolve directive: tippy」与「[ReIcon] 图标 ep/box 未随包内置」。
 */

const paneMenuItem = (page: import("@playwright/test").Page, text: string) =>
  page.locator(".el-menu-item", { hasText: text }).first();

test("账户设置：切换页签写入 URL，刷新后仍停留在同一页签", async ({ page }) => {
  await login(page);
  await page.goto("/#/account-settings");

  // 默认落地「个人信息」
  await expect(page.locator("h3").first()).toContainText("个人信息", {
    timeout: 15_000
  });

  // 切到「安全日志」：标题切换 + URL 同步
  await paneMenuItem(page, "安全日志").click();
  await expect(page.locator("h3").first()).toContainText("安全日志");
  await expect(page).toHaveURL(/tab=securityLog/);

  // 刷新 → 仍在「安全日志」（修复前会回落到第一个页签）
  await page.reload();
  await expect(page.locator("h3").first()).toContainText("安全日志", {
    timeout: 15_000
  });

  // 再切到「MFA 安全」并刷新：URL 覆盖而非累积，刷新后仍停留在该页签
  await paneMenuItem(page, "MFA 安全").click();
  await expect(page).toHaveURL(/tab=mfa/);
  await page.reload();
  await expect(page.locator("h3").first()).toContainText("MFA 安全", {
    timeout: 15_000
  });
});

test("安全日志：?tab= 直达渲染搜索区字段与本人登录记录", async ({ page }) => {
  await login(page);
  await page.goto("/#/account-settings?tab=securityLog");

  await expect(page.locator("h3").first()).toContainText("安全日志", {
    timeout: 15_000
  });

  // 搜索区必须渲染筛选控件（修复前 fetch-search-fields 关闭 + 后端缺 filterset，
  // 只剩一个「搜索」按钮；这里以字段控件的数量作为回归断言）
  const searchCard = page.locator(".re-plus-search-card").first();
  await expect(searchCard).toBeVisible();
  await expect
    .poll(async () => searchCard.locator(".el-form-item, .el-select").count(), {
      timeout: 15_000
    })
    .toBeGreaterThan(2);

  // 本人登录日志列表有数据（本用例的登录即产生一条记录）
  await expect(page.locator(".el-table__row").first()).toBeVisible({
    timeout: 15_000
  });
});

test("账户设置往返：布局重建不重复注册 vue-tippy（无重复插件告警）", async ({
  page
}) => {
  const dupeWarnings: string[] = [];
  page.on("console", message => {
    if (message.text().includes("Plugin has already been applied")) {
      dupeWarnings.push(message.text());
    }
  });

  await login(page);

  // 无布局页 → 布局页 → 无布局页：每轮往返都会重建布局组件（修复前每轮告警一次）
  for (let round = 0; round < 2; round++) {
    await page.goto("/#/account-settings");
    await expect(page.locator("h3").first()).toContainText("个人信息", {
      timeout: 15_000
    });
    await page.goto("/#/welcome");
    await expect(page.locator(".sidebar-container").first()).toBeVisible({
      timeout: 15_000
    });
  }

  expect(dupeWarnings).toEqual([]);
});

test("账户设置（无布局页）：图标与 v-tippy 指令自足，无未内置 / 指令未解析告警", async ({
  page
}) => {
  const iconWarnings: string[] = [];
  const directiveWarnings: string[] = [];
  page.on("console", message => {
    const text = message.text();
    if (text.includes("[ReIcon]")) iconWarnings.push(text);
    if (text.includes("Failed to resolve directive: tippy")) {
      directiveWarnings.push(text);
    }
  });

  await login(page);
  // 安全日志页签内是 RePlusPage：表格栏按钮的 JSX `v-tippy` 与列表空态图标都在此触发
  await page.goto("/#/account-settings?tab=securityLog");
  await expect(page.locator("h3").first()).toContainText("安全日志", {
    timeout: 15_000
  });
  await expect(page.locator(".re-plus-search-card").first()).toBeVisible();

  // 列表到达：有数据行或空态（ReEmpty 默认图标 `ep/box`）二者必有其一
  await expect
    .poll(
      async () => await page.locator(".el-table__row, .re-empty-art").count(),
      { timeout: 15_000 }
    )
    .toBeGreaterThan(0);

  expect(iconWarnings).toEqual([]);
  expect(directiveWarnings).toEqual([]);
});

test("账户管理：通道未就绪时绑定更新按钮置灰（受系统配置管理）", async ({
  page
}) => {
  await login(page);
  await page.goto("/#/account-settings?tab=accountManagement");
  await expect(page.locator("h3").first()).toContainText("账户管理", {
    timeout: 15_000
  });

  // 行序：密码 / 手机 / 邮箱；E2E 档未配置短信（SMS_ENABLED=False），手机更新必须置灰
  const rows = page.locator(".account-row");
  await expect(rows.nth(1).getByRole("button", { name: "更新" })).toBeDisabled({
    timeout: 15_000
  });
  // 邮件走 locmem 测试后端，通道视为就绪：邮箱更新保持可用
  await expect(rows.nth(2).getByRole("button", { name: "更新" })).toBeEnabled();
});
