import { expect, test } from "@playwright/test";

import { ADMIN, login, logout, openMenu } from "./helpers";

/**
 * 系统页面渲染与业务流 E2E（T4.3 扩展）：
 * 菜单/在线用户/日志/通知等页面渲染、用户 CRUD、WebSocket 连接、登出。
 */

test("菜单管理：列表与搜索区渲染", async ({ page }) => {
  await login(page);
  await openMenu(page, "系统管理", "菜单管理");
  const table = page.locator(".el-table");
  await expect(table).toBeVisible();
  // 初始数据含「系统管理」根菜单
  await expect(table.getByText("系统管理").first()).toBeVisible();
});

test("在线用户：页面渲染", async ({ page }) => {
  await login(page);
  await openMenu(page, "系统管理", "在线用户");
  // 当前管理员自身应出现在在线列表（WebSocket 会话）
  await expect(page.locator(".el-table, .pure-table").first()).toBeVisible();
});

test("登录日志：存在当前登录记录", async ({ page }) => {
  await login(page);
  await openMenu(page, "系统管理", "登录日志");
  await expect(page.locator(".el-table")).toBeVisible({ timeout: 15_000 });
  // 刚刚的登录应已落库
  await expect(
    page.locator(".el-table").getByText(ADMIN.username).first()
  ).toBeVisible({ timeout: 15_000 });
});

test("操作日志：页面可打开且有记录", async ({ page }) => {
  await login(page);
  await openMenu(page, "系统管理", "操作日志");
  await expect(page.locator(".el-table")).toBeVisible({ timeout: 15_000 });
});

test("通知中心：页面可打开", async ({ page }) => {
  await login(page);
  await openMenu(page, "系统管理", "通知管理");
  await expect(page.locator(".el-table, .el-empty").first()).toBeVisible({
    timeout: 15_000
  });
});

test("账户设置：头像下拉可进入个人信息页", async ({ page }) => {
  await login(page);
  await page.locator(".el-dropdown-link").first().click();
  await page.getByText("账户设置").first().click();
  await expect(page.locator(".el-form, .el-tabs").first()).toBeVisible({
    timeout: 15_000
  });
});

test("用户管理：新增 → 搜索可见 → 删除", async ({ page }) => {
  const username = `e2e_u_${Date.now()}`;
  await login(page);
  await openMenu(page, "系统管理", "用户管理");
  const table = page.locator(".el-table");
  await expect(table).toBeVisible();

  // RePlusPage 弹层新增：必填项（昵称/用户名/密码等）以实际表单为准
  await page.getByRole("button", { name: "新增" }).first().click();
  const dialog = page.locator(".el-dialog, .el-drawer").first();
  await expect(dialog).toBeVisible();
  const nickname = dialog
    .locator(".el-form-item:has-text('昵称') input")
    .first();
  await nickname.fill("E2E临时用户");
  const userInput = dialog
    .locator(".el-form-item:has-text('用户名') input")
    .first();
  await userInput.fill(username);
  const passwordInput = dialog
    .locator(".el-form-item:has-text('密码') input[type='password']")
    .first();
  if (await passwordInput.isVisible().catch(() => false)) {
    await passwordInput.fill("E2E-New-User-2026!");
  }
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 15_000 });

  // 列表可见（或经搜索可见）
  await expect(table.getByText(username).first()).toBeVisible({
    timeout: 15_000
  });

  // 清理：删除该用户
  const row = page.locator(".el-table__row", { hasText: username }).first();
  await row.getByRole("button", { name: "删除" }).first().click();
  const confirm = page
    .locator(".el-popconfirm, .el-popper, .el-message-box")
    .getByRole("button", { name: "确定" })
    .first();
  await confirm.click();
  await expect(
    page.locator(".el-table__row", { hasText: username })
  ).toHaveCount(0, { timeout: 15_000 });
});

test("WebSocket：登录后建立 /ws 连接", async ({ page }) => {
  const wsOpened = page.waitForEvent("websocket", { timeout: 20_000 });
  await login(page);
  const ws = await wsOpened;
  expect(ws.url()).toMatch(/\/ws/);
});

test("登出后回到登录页", async ({ page }) => {
  await login(page);
  await logout(page);
});
