import { expect, test } from "@playwright/test";

import {
  BACKEND_URL,
  getAccessToken,
  login,
  openList,
  openUserPanel
} from "./helpers";

/**
 * 用户管理行操作抽屉：
 * - 操作列收敛为「编辑 / 删除 / 管理」，默认「查看」「变更历史」入口并入抽屉；
 * - 行内头像与用户名同为抽屉入口；
 * - 抽屉内按语义分组渲染动作，权限缺失的动作不渲染、空分组剔除；
 * - 动作执行前先收起抽屉再打开二级弹窗。
 *
 * 行级数据（在线会话数等）会随并行用例变化，涉及行级判定的断言使用
 * 本用例自建的临时账号，避免双浏览器共享库互扰。
 */
test.use({ viewport: { width: 1280, height: 1080 } });

test("用户抽屉：管理入口、分组动作与二级弹窗", async ({ page }) => {
  await login(page);
  await openList(page, "/system/user/index", {
    placeholder: "请输入用户名",
    value: "xadmin"
  });
  const row = page
    .locator(".el-table__row")
    .filter({ hasText: "xadmin" })
    .first();
  await expect(row).toBeVisible({ timeout: 10_000 });

  // 操作列只保留编辑 / 删除 / 管理（默认「查看」「变更历史」已并入抽屉，无「更多」折叠）
  await expect(row.getByRole("button", { name: "编辑" })).toBeVisible();
  await expect(row.getByRole("button", { name: "删除" })).toBeVisible();
  await expect(row.locator(".el-dropdown")).toHaveCount(0);

  const panel = await openUserPanel(page, row);
  await expect(panel).toContainText("账号与安全");
  await expect(panel).toContainText("权限与角色");
  await expect(
    panel.locator('[data-action-code="resetPassword"]')
  ).toBeVisible();
  await expect(panel.locator('[data-action-code="preview"]')).toBeVisible();

  // 抽屉内动作：先收起抽屉再打开二级弹窗（重置密码）
  await panel.locator('[data-action-code="resetPassword"]').click();
  const dialog = page.locator(".el-dialog", { hasText: "重置用户" }).first();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog.locator(".el-dialog__headerbtn").click();
  await expect(dialog).not.toBeVisible();
});

test("用户抽屉：点击用户名打开同一抽屉", async ({ page }) => {
  await login(page);
  await openList(page, "/system/user/index", {
    placeholder: "请输入用户名",
    value: "xadmin"
  });
  const row = page
    .locator(".el-table__row")
    .filter({ hasText: "xadmin" })
    .first();
  await expect(row).toBeVisible({ timeout: 10_000 });

  await row.getByText("xadmin", { exact: true }).first().click();
  const drawer = page
    .locator(".el-drawer")
    .filter({ hasText: "管理用户" })
    .first();
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  await expect(drawer).toContainText("@xadmin");
});

test("用户抽屉：无在线会话时强制下线不可用", async ({ page }) => {
  await login(page);

  // 自建临时账号：online_count 恒为 0（共享库下 e2e_user 等账号可能被并行用例登录）。
  // 密码选型有坑：服务端会先按密文协议解密，明文若恰好被 base64 解码成空串会被判
  // 「密码不满足安全规则」，必须选解密抛异常（回退明文）的字符串，见 e2e/README 陷阱表
  const username = `e2e_panel_${Date.now()}`;
  const token = await getAccessToken(page);
  const created = await page.request.post(`${BACKEND_URL}/api/system/user`, {
    data: {
      username,
      nickname: "抽屉面板用例",
      password: "P@ssw0rd-E2EPanel-2026"
    },
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(created.status(), await created.text()).toBe(200);

  await openList(page, "/system/user/index", {
    placeholder: "请输入用户名",
    value: username
  });
  const row = page
    .locator(".el-table__row")
    .filter({ hasText: username })
    .first();
  await expect(row).toBeVisible({ timeout: 10_000 });

  const panel = await openUserPanel(page, row);
  const logout = panel.locator('[data-action-code="logout"]');
  await expect(logout).toBeVisible();
  await expect(logout).toBeDisabled();
});
