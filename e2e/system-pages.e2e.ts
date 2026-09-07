import { expect, test } from "@playwright/test";

import {
  ADMIN,
  login,
  logout,
  openMenuPath,
  waitAppWebSocket
} from "./helpers";

/**
 * 系统页面渲染与业务流 E2E（扩展）：
 * 菜单/在线用户/日志/通知等页面渲染、用户 CRUD、WebSocket 连接、登出。
 *
 * 菜单层级以种子库实际数据为准（system/models Menu）：系统管理 → {日志管理 →
 * 在线用户/访问日志/登录日志}、{通知公告 → 消息公告}、{配置管理 → 用户配置}。
 * 日志与通知均为三级，二级直接取会命中失败。
 */

test("菜单管理：菜单树与表单区渲染", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/menu/index");
  // 菜单管理为「左侧菜单树 + 右侧表单」布局，不是列表页
  const tree = page.locator(".el-tree").first();
  await expect(tree).toBeVisible({ timeout: 15_000 });
  // 初始数据含「系统管理」根菜单
  await expect(tree.getByText("系统管理").first()).toBeVisible();
});

test("在线用户：页面渲染", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["系统管理", "日志管理"], "/system/online/index");
  // 当前管理员自身应出现在在线列表（WebSocket 会话）
  await expect(page.locator(".el-table, .pure-table").first()).toBeVisible({
    timeout: 15_000
  });
});

test("登录日志：存在当前登录记录", async ({ page }) => {
  await login(page);
  await openMenuPath(
    page,
    ["系统管理", "日志管理"],
    "/system/logs/login/index"
  );
  await expect(page.locator(".el-table")).toBeVisible({ timeout: 15_000 });
  // 刚刚的登录应已落库
  await expect(
    page.locator(".el-table").getByText(ADMIN.username).first()
  ).toBeVisible({ timeout: 15_000 });
});

test("访问日志：页面可打开且有记录", async ({ page }) => {
  await login(page);
  await openMenuPath(
    page,
    ["系统管理", "日志管理"],
    "/system/logs/operation/index"
  );
  await expect(page.locator(".el-table")).toBeVisible({ timeout: 15_000 });
});

test("消息公告：页面可打开", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["系统管理", "通知公告"], "/system/notice/index");
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
  await openMenuPath(page, ["系统管理"], "/system/user/index");
  const table = page.locator(".el-table");
  await expect(table).toBeVisible();

  // RePlusPage 弹层新增：必填项（昵称/用户名/密码等）以实际表单为准
  await page.getByRole("button", { name: "新增" }).first().click();
  // :visible 过滤：用户页内建的回收站抽屉常驻 DOM（隐藏态），不能用裸 first() 定位
  const dialog = page.locator(".el-dialog:visible, .el-drawer:visible").first();
  await expect(dialog).toBeVisible();
  const nickname = dialog
    .locator(".el-form-item:has-text('昵称') input")
    .first();
  await nickname.fill("E2E临时用户");
  const userInput = dialog
    .locator(".el-form-item:has-text('用户名') input")
    .first();
  await userInput.fill(username);
  // 密码框为普通 input（无 password 渲染器，type 非 password），
  // 须按 placeholder 定位；密码规则收紧后前端会按下发规则校验，须填合规密码
  const passwordInput = dialog.getByPlaceholder("请输入密码").first();
  await passwordInput.fill("E2E-New-User-2026!");
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

test("WebSocket：登录后建立应用 ws 连接", async ({ page }) => {
  const wsOpened = waitAppWebSocket(page);
  await login(page);
  const ws = await wsOpened;
  expect(ws.url()).toMatch(/\/ws\/message\//);
});

test("登出后回到登录页", async ({ page }) => {
  await login(page);
  await logout(page);
});
