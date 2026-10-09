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
