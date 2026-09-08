import { expect, test, type Page } from "@playwright/test";

import {
  ADMIN,
  BACKEND_URL,
  PLAIN_USER,
  getAccessToken,
  login
} from "./helpers";

/**
 * 认证与权限 E2E：登录失败路径、受限用户菜单收敛、API 水平越权。
 * 依赖 tests.settings_e2e：关验证码/加密，放宽登录失败锁定阈值。
 */

async function expectLoginError(page: Page, message: RegExp) {
  await page.goto("/#/login");
  await page.getByPlaceholder("账号").fill("definitely-not-exists-user");
  await page.getByPlaceholder("密码").fill("Wrong-Pass-000!");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(
    page.locator(".el-message, .el-notification").getByText(message).first()
  ).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/#\/login/);
}

test("登录失败：账号不存在时提示错误并停留在登录页 @smoke", async ({
  page
}) => {
  await expectLoginError(page, /用户不存在|账号|密码/);
});

test("登录失败：密码错误时提示错误并停留在登录页", async ({ page }) => {
  await page.goto("/#/login");
  await page.getByPlaceholder("账号").fill(ADMIN.username);
  await page.getByPlaceholder("密码").fill("Totally-Wrong-000!");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(
    page
      .locator(".el-message, .el-notification")
      .getByText(/密码|锁定|失败|错误|正确/)
      .first()
  ).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/#\/login/);
});

test("受限用户：登录成功但看不到系统管理菜单", async ({ page }) => {
  await login(page, PLAIN_USER);
  // e2e_scoped 未绑定任何角色 → 无菜单权限
  await expect(page.getByRole("menuitem", { name: "系统管理" })).toHaveCount(0);
  await logoutIfPossible(page);
});

test("受限用户：直接访问系统管理路由仍无法取得用户列表数据", async ({
  page
}) => {
  await login(page, PLAIN_USER);
  // 越权访问用户管理页面：路由可能进入，但列表数据必须被数据权限拦下
  await page.goto("/#/system/users");
  await page.waitForTimeout(1_000);
  const response = await page.request.get(
    `${BACKEND_URL}/api/system/user?page=1&limit=10`,
    {
      headers: {
        Authorization: `Bearer ${await getAccessToken(page)}`,
        "User-Agent": "e2e-test"
      }
    }
  );
  expect([401, 403]).toContain(response.status());
});

test("普通用户 API 越权：携带合法 token 直接调用用户管理接口被拒", async ({
  page
}) => {
  await login(page, PLAIN_USER);
  const response = await page.request.get(
    `${BACKEND_URL}/api/system/role?page=1&limit=10`,
    {
      headers: {
        Authorization: `Bearer ${await getAccessToken(page)}`,
        "User-Agent": "e2e-test"
      }
    }
  );
  expect([401, 403]).toContain(response.status());
});

test("管理员合法调用同一接口返回 200 @smoke", async ({ page }) => {
  await login(page, ADMIN);
  const response = await page.request.get(
    `${BACKEND_URL}/api/system/role?page=1&limit=10`,
    {
      headers: {
        Authorization: `Bearer ${await getAccessToken(page)}`,
        "User-Agent": "e2e-test"
      }
    }
  );
  expect(response.status()).toBe(200);
});

/** 受限用户可能没有可用的下拉（头像菜单依赖路由），尽力登出复位状态 */
async function logoutIfPossible(page: Page) {
  try {
    const dropdown = page.locator(".el-dropdown-link").first();
    if (await dropdown.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await dropdown.click();
      await page.getByText("退出系统").first().click();
      const confirm = page
        .locator(".el-popconfirm, .el-popper, .el-message-box")
        .getByRole("button", { name: "确定" })
        .first();
      if (await confirm.isVisible().catch(() => false)) {
        await confirm.click();
      }
      await expect(page).toHaveURL(/#\/login/, { timeout: 10_000 });
      return;
    }
  } catch {
    // 忽略：直接清态重开即可（workers=1 串行执行，登录页状态由 login() 复位）
  }
  await page.context().clearCookies();
  await page.goto("/#/login");
}
