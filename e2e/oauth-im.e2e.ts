import { expect, test } from "@playwright/test";

import { login } from "./helpers";

/**
 * 企业 IM 扫码登录入口：种子注入启用态 feishu flavor provider，
 * 登录页必须渲染对应入口按钮（providers 接口 + flavor 预设合并全链路）。
 *
 * 回调交互依赖真实 IdP，由后端集成测试 stub HTTP 覆盖（tests/unit/system/
 * test_oauth_flavors.py），E2E 不点击入口按钮。
 */
test("登录页展示启用态 IM 扫码入口（feishu flavor）", async ({ page }) => {
  await page.goto("/#/login");
  // 第三方入口区块随 provider 配置渲染（无配置时整体隐藏）
  const imEntry = page.getByRole("button", { name: "E2E飞书" });
  await expect(imEntry).toBeVisible({ timeout: 30_000 });

  // 登录流程不受第三方入口影响（本地账密照常）
  await login(page);
  await expect(page.getByRole("menuitem", { name: "系统管理" })).toBeVisible();
});
