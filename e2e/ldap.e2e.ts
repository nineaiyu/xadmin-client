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

  // 设置页不是登录表单：浏览器不能把站点登录凭据自动填进绑定 DN/密码
  // （曾实测 Bind DN 被填成登录账号、密码框被填满，离开时误弹未保存确认）
  await expect(
    page.locator(".el-form-item:has-text('绑定 DN') input").first()
  ).toHaveAttribute("autocomplete", "off");
  await expect(
    page.locator(".el-form-item:has-text('绑定密码') input").first()
  ).toHaveAttribute("autocomplete", "new-password");

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

test("LDAP 设置：未保存离开提示使用站点文案（不回显 i18n key）", async ({
  page
}) => {
  await login(page);
  await openMenuPath(page, ["系统设置"], "/settings/ldap");

  const serverUri = page
    .locator(`.el-form-item:has-text('${LDAP_LABEL.serverUri}') input`)
    .first();
  await expect(serverUri).toBeVisible({ timeout: 15_000 });
  // 只改表单不保存：触发 useDesignerGuard 的 dirty 分支
  await serverUri.fill("ldap://127.0.0.1:3891");

  // 走真实菜单点击（router.push 单次导航）：直接改 hash 会先改地址再被守卫拦回，
  // hashchange 往返会让同一个确认框反复重建，点击始终等不到稳定态。
  await page.getByRole("menuitem", { name: "首页" }).first().click();

  const box = page.locator(".el-message-box");
  await expect(box).toBeVisible({ timeout: 10_000 });
  await expect(box).toContainText("当前设置尚未保存");
  await expect(box).toContainText("有未保存的修改");
  // 旧实现把 localeName/title 拼进命名空间，弹窗直接显示 setting:... 原始 key
  await expect(box).not.toContainText("setting:");
  await expect(box.getByRole("button", { name: "离开" })).toBeVisible();
  await box.getByRole("button", { name: "留在本页" }).click();

  await expect(box).not.toBeVisible();
  await expect(page).toHaveURL(/\/settings\/ldap/);
});

test("LDAP 设置：未修改离开不弹未保存确认", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["系统设置"], "/settings/ldap");

  const serverUri = page
    .locator(`.el-form-item:has-text('${LDAP_LABEL.serverUri}') input`)
    .first();
  await expect(serverUri).toBeVisible({ timeout: 15_000 });

  await page.getByRole("menuitem", { name: "首页" }).first().click();
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.locator(".el-message-box")).not.toBeVisible();
});
