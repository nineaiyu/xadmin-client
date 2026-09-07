import { expect, test } from "@playwright/test";

import { BACKEND_URL, getAccessToken, login } from "./helpers";

/**
 * FEAT-2 回收站 E2E（遗留收口）：角色删除 → 回收站可见 → 恢复 → 列表重现。
 * 覆盖 RePlusPage barButtons 入口、ReRecycleBin 抽屉与 recycle/restore 链路。
 */

test("角色回收站：删除 → 回收站恢复 → 列表重现", async ({ page }) => {
  const roleName = `e2e回收站角色_${Date.now()}`;
  const roleCode = `e2e_recycle_${Date.now()}`;

  await login(page);

  // API 创建待删角色（表单创建链路已由其他用例覆盖）；先创建后进页面，
  // 使新角色自然出现在首屏列表，无需手动刷新
  const token = await getAccessToken(page);
  const created = await page.request.post(`${BACKEND_URL}/api/system/role`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "e2e-test"
    },
    data: { name: roleName, code: roleCode, fields: {} }
  });
  expect(created.ok()).toBeTruthy();

  // 角色管理位于三级目录：系统管理 → 权限管理 → 角色权限
  await page.getByRole("menuitem", { name: "系统管理" }).first().click();
  const perm = page.getByRole("menuitem", { name: "权限管理" }).first();
  await perm.waitFor({ state: "visible" });
  await perm.click();
  const roleItem = page.getByRole("menuitem", { name: "角色权限" }).first();
  await roleItem.waitFor({ state: "visible" });
  await roleItem.click();
  const table = page.locator(".el-table");
  await expect(table).toBeVisible({ timeout: 15_000 });

  await page
    .locator(".el-table__row", { hasText: roleName })
    .first()
    .waitFor({ state: "visible", timeout: 15_000 });

  // UI 删除（软删除）
  const row = page.locator(".el-table__row", { hasText: roleName }).first();
  await row.getByRole("button", { name: "删除" }).first().click();
  const confirm = page
    .locator(".el-popconfirm, .el-popper, .el-message-box")
    .getByRole("button", { name: "确定" })
    .first();
  await confirm.click();
  await expect(
    page.locator(".el-table__row", { hasText: roleName })
  ).toHaveCount(0, { timeout: 15_000 });

  // 打开回收站抽屉，已删除角色可见
  await page.getByRole("button", { name: "回收站" }).first().click();
  const drawer = page.locator(".el-drawer.recycle-bin-drawer");
  await expect(drawer).toBeVisible();
  const drawerRow = drawer.locator(".el-table__row", { hasText: roleName });
  await expect(drawerRow).toBeVisible({ timeout: 15_000 });

  // 单行恢复 → 抽屉中消失（popconfirm 的 popper teleport 到 body，须 page 级定位）
  await drawerRow.getByRole("button", { name: "恢复" }).last().click();
  await page
    .locator(".el-popper")
    .filter({ hasText: "确定恢复该条数据" })
    .getByRole("button", { name: "确定" })
    .first()
    .click();
  await expect(drawerRow).toHaveCount(0, { timeout: 15_000 });

  // 关闭抽屉，主列表重现（changed 事件触发刷新）
  await drawer.locator(".el-drawer__close-btn").first().click();
  await expect(drawer).not.toBeVisible({ timeout: 15_000 });
  await expect(
    page.locator(".el-table__row", { hasText: roleName }).first()
  ).toBeVisible({ timeout: 15_000 });
});
