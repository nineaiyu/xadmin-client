import { expect, test } from "@playwright/test";

import {
  ADMIN,
  BACKEND_URL,
  DP_USER,
  FP_USER,
  getAccessToken,
  login
} from "./helpers";

/**
 * 三层权限 E2E（T4.3）：数据权限越权验证 + 字段权限列隐藏。
 * 种子见 scripts/e2e_seed.py：
 * - e2e_dp 携带 DataPermission「E2E-仅本人用户数据」（table=system.userinfo, type=value.user.id）
 * - e2e_fp 的角色在用户列表菜单配置了 FieldPermission 白名单（email 被剔除）
 */

const USER_LIST_API = `${BACKEND_URL}/api/system/user?page=1&limit=10`;

async function openUserManagement(page: import("@playwright/test").Page) {
  await page.getByRole("menuitem", { name: "系统管理" }).first().click();
  const item = page.getByRole("menuitem", { name: "用户管理" }).first();
  await item.waitFor({ state: "visible" });
  await item.click();
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });
}

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
  test("受限角色：用户列表表头不出现邮件列", async ({ page }) => {
    await login(page, FP_USER);
    await openUserManagement(page);
    const header = page.locator(".el-table__header");
    await expect(header).toBeVisible({ timeout: 15_000 });
    await expect(header).not.toContainText(/邮件|邮箱/);
    // 序列化层裁剪：数据行同样不应出现 email 值
    await expect(page.locator(".el-table__body")).not.toContainText(
      /@e2e\.local/
    );
  });

  test("对照：管理员用户列表保留邮件列", async ({ page }) => {
    await login(page);
    await openUserManagement(page);
    const header = page.locator(".el-table__header");
    await expect(header).toBeVisible({ timeout: 15_000 });
    await expect(header).toContainText(/邮件|邮箱/);
  });

  test("受限角色：携带合法 token 调用列表接口，响应字段被裁剪", async ({
    page
  }) => {
    await login(page, FP_USER);
    const response = await page.request.get(
      `${BACKEND_URL}/api/system/user?page=1&limit=10`,
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
    expect(first).not.toHaveProperty("email");
  });
});
