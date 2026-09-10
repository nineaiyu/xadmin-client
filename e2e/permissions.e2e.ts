import { expect, test } from "@playwright/test";

import {
  ADMIN,
  DP_USER,
  FP_USER,
  FRONT_URL,
  LEADER_MEMBER_USERNAME,
  LEADER_USER,
  getAccessToken,
  login,
  openUserManagement
} from "./helpers";

/**
 * 三层权限 E2E：数据权限越权验证 + 字段权限列隐藏。
 * 种子见 scripts/e2e_seed.py：
 * - e2e_dp 携带 DataPermission「E2E-仅本人用户数据」（table=system.userinfo, type=value.user.id）
 * - e2e_leader 主管「E2E-主管测试部」（本人兼成员），携带 DataPermission
 *   「E2E-主管部门成员」（type=value.leader.user.ids），列表可见本人 + 部门成员
 * - e2e_fp 的角色在用户列表菜单配置了 FieldPermission 白名单（email 被剔除）
 *
 * 列表接口断言走同源 FRONT_URL：这两个账号仅靠会话 Cookie 鉴权，
 * 跨域直连后端不带 Cookie 会直接 401。
 */

const USER_LIST_API = `${FRONT_URL}/api/system/user?page=1&limit=10`;

test.describe("数据权限", () => {
  test("仅本人数据：界面列表只出现自己一条记录", async ({ page }) => {
    await login(page, DP_USER);
    await openUserManagement(page);
    const rows = page.locator(".el-table__row");
    await expect(rows).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator(".el-table")).toContainText(DP_USER.username);
    await expect(page.locator(".el-table")).not.toContainText(ADMIN.username);
  });

  test("仅本人数据：直接调用列表 API 也只返回本人", async ({ page }) => {
    await login(page, DP_USER);
    const response = await page.request.get(USER_LIST_API, {
      headers: { "User-Agent": "e2e-test" }
    });
    expect(response.status()).toBe(200);
    const payload = await response.json();
    const results: Array<Record<string, unknown>> =
      payload?.data?.results ?? payload?.data ?? [];
    expect(results).toHaveLength(1);
    expect(String(results[0]?.username)).toBe(DP_USER.username);
  });

  test("部门主管：列表仅可见本人与主管部门成员", async ({ page }) => {
    await login(page, LEADER_USER);
    await openUserManagement(page);
    const rows = page.locator(".el-table__row");
    await expect(rows).toHaveCount(2, { timeout: 15_000 });
    await expect(page.locator(".el-table")).toContainText(LEADER_USER.username);
    await expect(page.locator(".el-table")).toContainText(
      LEADER_MEMBER_USERNAME
    );
    await expect(page.locator(".el-table")).not.toContainText(ADMIN.username);
  });

  test("对照：管理员可见全部用户记录", async ({ page }) => {
    await login(page);
    await openUserManagement(page);
    const rows = page.locator(".el-table__row");
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
    const count = await rows.count();
    expect(count).toBeGreaterThan(1);
  });
});

test.describe("字段权限", () => {
  // 场景字段选 phone 而非 email：UserInfo 序列化器 table_fields 不含 email
  // （该列默认不渲染，表头断言无从谈起）；phone 在默认表格列中
  test("受限角色：用户列表表头不出现手机列", async ({ page }) => {
    await login(page, FP_USER);
    await openUserManagement(page);
    const header = page.locator(".el-table__header");
    await expect(header).toBeVisible({ timeout: 15_000 });
    await expect(header).toContainText(/用户名/);
    await expect(header).not.toContainText(/手机/);
  });

  test("对照：管理员用户列表保留手机列", async ({ page }) => {
    await login(page);
    await openUserManagement(page);
    const header = page.locator(".el-table__header");
    await expect(header).toBeVisible({ timeout: 15_000 });
    await expect(header).toContainText(/手机/);
  });

  test("受限角色：携带合法 token 调用列表接口，响应字段被裁剪", async ({
    page
  }) => {
    await login(page, FP_USER);
    const response = await page.request.get(
      `${FRONT_URL}/api/system/user?page=1&limit=10`,
      {
        headers: {
          Authorization: `Bearer ${await getAccessToken(page)}`,
          "User-Agent": "e2e-test"
        }
      }
    );
    expect(response.status()).toBe(200);
    const payload = await response.json();
    const first = (payload?.data?.results ?? [])[0] as
      Record<string, unknown> | undefined;
    expect(first).toBeDefined();
    expect(first).not.toHaveProperty("phone");
    expect(first).toHaveProperty("username");
  });
});
