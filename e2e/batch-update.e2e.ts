import { expect, test } from "@playwright/test";

import { BACKEND_URL, getAccessToken, login, openMenuPath } from "./helpers";

/**
 * 批量更新通用弹窗（角色列表为入口页）。
 *
 * 覆盖：勾选行 → 工具栏「批量更新」→ 表单契约取载荷 → PATCH 落库 → 列表回显。
 * 该弹窗是 5 个页面共用的通用组件（角色/字典/部门等），表单契约
 * `getPayload()` 返回 `null` 时调用方保持弹窗并提示，故这里断言「选中字段后能真正保存」。
 *
 * 数据：API 建临时角色（幂等，用后不禁用不影响他人），只读取列表定位自己的行。
 */
test("角色列表：批量更新启用状态（通用弹窗端到端）", async ({ page }) => {
  await login(page);

  const token = await getAccessToken(page);
  const suffix = Date.now();
  const roleName = `E2E批量更新${suffix}`;
  const headers = { Authorization: `Bearer ${token}` };
  const created = await page.request.post(`${BACKEND_URL}/api/system/role`, {
    headers,
    // fields 为字段权限地图（write_only 必填）：空对象 = 不设字段权限
    data: { name: roleName, code: `e2e_batch_${suffix}`, fields: {} }
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const rolePk = ((await created.json()) as { data: { pk: string } }).data.pk;

  await openMenuPath(page, ["系统管理", "权限管理"], "/system/role/index");
  const row = page.locator(".el-table__row", { hasText: roleName }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  // 新建角色默认启用：作为「变更前」基线
  await expect(row.locator(".el-switch").first()).toHaveClass(/is-checked/);

  await row.locator(".el-checkbox").first().click();
  await page
    .getByRole("button", { name: /批量更新/ })
    .first()
    .click();

  const dialog = page.locator(".el-dialog:visible").first();
  await expect(dialog).toBeVisible();
  // 字段白名单只有「启用状态」一项（文案按语言包可能是「状态」），按下拉首项选中；
  // 开关默认关闭 ⇒ 保存即把选中行置为停用
  await dialog.locator(".el-select").first().click();
  await page
    .locator(".el-select-dropdown:visible .el-select-dropdown__item")
    .first()
    .click();
  await dialog.getByRole("button", { name: /保存/ }).first().click();

  await expect(dialog).toBeHidden({ timeout: 15_000 });

  // 落库断言（该行有多个布尔列开关，按接口判据更稳）
  const detail = await page.request.get(
    `${BACKEND_URL}/api/system/role/${rolePk}`,
    { headers }
  );
  expect(
    ((await detail.json()) as { data: { is_active: boolean } }).data.is_active
  ).toBe(false);

  // 列表回显：行内首个开关即 is_active 列，已变为关闭
  await expect(
    page
      .locator(".el-table__row", { hasText: roleName })
      .first()
      .locator(".el-switch")
      .first()
  ).not.toHaveClass(/is-checked/, { timeout: 15_000 });
});
