import { expect, test } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 开放平台设置页与账户「已授权应用」页签：
 * 覆盖新页面的菜单可达性、页签渲染与空态（不写配置，避免污染共享种子库）。
 */
test("开放平台设置：SCIM / 第三方登录 / 已授权应用三页签渲染", async ({
  page
}) => {
  await login(page);
  await openMenuPath(page, ["系统设置"], "/settings/open-platform");

  const scimTab = page.getByRole("tab", { name: "SCIM 目录同步" });
  const oauthTab = page.getByRole("tab", { name: "第三方登录" });
  const authorizedTab = page.getByRole("tab", { name: "已授权应用" });
  await expect(scimTab).toBeVisible({ timeout: 15_000 });
  await expect(oauthTab).toBeVisible();
  await expect(authorizedTab).toBeVisible();

  // SCIM 面板：后端元数据驱动的字段与令牌轮换入口
  await expect(page.getByText("SCIM 限流")).toBeVisible();
  await expect(page.getByText("生成/轮换令牌")).toBeVisible();

  await oauthTab.click();
  await expect(page.getByText("添加提供商")).toBeVisible();
  await expect(page.getByText("原始 JSON")).toBeVisible();

  await authorizedTab.click();
  await expect(page.getByTestId("authorized-admin-table")).toBeVisible();
});

test("账户设置：已授权应用页签可达", async ({ page }) => {
  await login(page);
  await page.goto("/#/account-settings?tab=authorizedApps");
  await expect(page.getByRole("heading", { name: "已授权应用" })).toBeVisible({
    timeout: 15_000
  });
  await expect(page.getByTestId("authorized-apps-table")).toBeVisible();
});
