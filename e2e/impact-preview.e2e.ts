import { expect, test } from "@playwright/test";

import { AesEncrypted } from "../src/utils/aes";

import { BACKEND_URL, getAccessToken, login, openMenuPath } from "./helpers";

/**
 * 影响面预检：删除有引用的角色时，删除动作前弹窗展示「会影响谁」；
 * 取消后角色保留（删除中止），确认后按既有链路执行。
 *
 * 数据准备走 API（角色 + 绑定该角色的用户），UI 只做删除动作与弹窗断言。
 */

test("删除有引用的角色：影响面弹窗展示绑定用户，取消则中止删除", async ({
  page
}) => {
  await login(page);
  const token = await getAccessToken(page);
  const headers = { Authorization: `Bearer ${token}` };
  const suffix = Date.now();

  const roleName = `E2E影响面角色${suffix}`;
  const roleResp = await page.request.post(`${BACKEND_URL}/api/system/role`, {
    headers,
    // fields 为字段权限地图（write_only 必填）：空对象 = 不设字段权限
    data: { name: roleName, code: `e2e_impact_${suffix}`, fields: {} }
  });
  expect(roleResp.ok(), await roleResp.text()).toBeTruthy();
  const rolePk = ((await roleResp.json()) as { data: { pk: string } }).data.pk;

  const username = `e2e_impact_user_${suffix}`;
  const userResp = await page.request.post(`${BACKEND_URL}/api/system/user`, {
    headers,
    data: {
      username,
      nickname: username,
      password: await AesEncrypted(username, "E2E-Impact-2026!"),
      roles: [rolePk]
    }
  });
  expect(userResp.ok(), await userResp.text()).toBeTruthy();

  try {
    await openMenuPath(page, ["系统管理", "权限管理"], "/system/role/index");
    const row = page.locator(".el-table__row", { hasText: roleName }).first();
    await row.waitFor({ state: "visible", timeout: 30_000 });

    // 行删除 → 二次确认 popconfirm → 影响面弹窗
    await row.getByRole("button", { name: "删除" }).first().click();
    await page
      .locator(".el-popconfirm, .el-popper, .el-message-box")
      .getByRole("button", { name: "确定" })
      .first()
      .click();

    const impactDialog = page
      .locator(".el-message-box", { hasText: "影响面预览" })
      .first();
    await expect(impactDialog).toBeVisible({ timeout: 15_000 });
    await expect(impactDialog).toContainText("绑定该角色的用户");
    await expect(impactDialog).toContainText(username);

    // 取消：删除中止，角色仍在（后端未收到删除请求）
    await impactDialog.getByRole("button", { name: "取消" }).first().click();
    await expect(impactDialog).not.toBeVisible();
    await expect(row).toBeVisible();
    const stillThere = await page.request.get(
      `${BACKEND_URL}/api/system/role/${rolePk}`,
      { headers }
    );
    expect(stillThere.ok()).toBeTruthy();
  } finally {
    // 清理：先解绑用户再删除角色（角色被引用时 PROTECT/影响面均可能阻断）
    const listed = await page.request.get(
      `${BACKEND_URL}/api/system/user?username=${encodeURIComponent(username)}`,
      { headers }
    );
    const rows = ((await listed.json()) as { data?: { results?: unknown[] } })
      .data?.results as Array<{ pk: string }> | undefined;
    for (const item of rows ?? []) {
      await page.request
        .delete(`${BACKEND_URL}/api/system/user/${item.pk}`, { headers })
        .catch(() => undefined);
    }
    await page.request
      .delete(
        `${BACKEND_URL}/api/system/role/${rolePk}?impact_confirmed=true`,
        {
          headers
        }
      )
      .catch(() => undefined);
  }
});
