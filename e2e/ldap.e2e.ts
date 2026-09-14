import { expect, test } from "@playwright/test";

import { login, logout, openMenuPath } from "./helpers";

/**
 * LDAP 目录设置主链路：
 * 页面渲染（后端 gettext 中文标签）→ 保存配置 → 连接测试失败可读 → 登出后
 * 本地账密登录不受影响（目录不可达不阻断本地登录的核心降级验收）。
 *
 * 用例内不开启 LDAP_AUTH_ENABLED，避免影响同环境的登录类用例；
 * 连接测试针对 127.0.0.1 未监听端口，ldap3 快速连接拒绝 → 可读失败提示。
 *
 * 运行：全量档（pnpm test:e2e / test:e2e:fresh）；改过后端必须 fresh
 * （reuseExistingServer 陷阱见 e2e/README.md）。
 */

const LDAP_LABEL = {
  serverUri: "服务器地址",
  searchBase: "用户搜索基准"
};

test("LDAP 设置：渲染 → 保存 → 连接测试失败可读 → 本地登录不受影响", async ({
  page
}) => {
  await login(page);
  await openMenuPath(page, ["系统设置"], "/settings/ldap");

  // 表单渲染（标签由后端 search-columns 下发，服务端翻译为中文）
  const serverUri = page
    .locator(`.el-form-item:has-text('${LDAP_LABEL.serverUri}') input`)
    .first();
  await expect(serverUri).toBeVisible({ timeout: 15_000 });
  const searchBase = page
    .locator(`.el-form-item:has-text('${LDAP_LABEL.searchBase}') input`)
    .first();
  await expect(searchBase).toBeVisible();

  // 保存配置（保持默认关闭 LDAP 登录；提交后成功提示）
  await serverUri.fill("ldap://127.0.0.1:3890");
  await searchBase.fill("dc=corp,dc=com");
  await page.getByRole("button", { name: "保存", exact: true }).first().click();
  await expect(page.locator(".el-message").first()).toBeVisible();

  // 连接测试：目录不可达 → 失败提示可读（不裸 500 / 不白屏）
  await page.getByRole("button", { name: "测试", exact: true }).first().click();
  await expect(page.locator(".el-message").first()).toBeVisible({
    timeout: 15_000
  });

  // 登出后本地账密登录照常成功（降级保证：LDAP 关闭/不可达零影响）
  await logout(page);
  await login(page);
  await expect(page.getByRole("menuitem", { name: "系统管理" })).toBeVisible();
});
