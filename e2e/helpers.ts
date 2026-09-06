import { expect, type Page } from "@playwright/test";

/**
 * E2E 公共助手：凭据与登录/登出/菜单导航。
 * 凭据与 xadmin-server/scripts/e2e_seed.py 的种子数据保持一致。
 */

/** 后端直连地址（page.request 越权断言用）；与 playwright.config.ts 的 E2E_API_PORT 对齐 */
export const BACKEND_URL =
  process.env.E2E_API_URL ??
  `http://127.0.0.1:${process.env.E2E_API_PORT ?? "8896"}`;

export const ADMIN = { username: "xadmin", password: "E2E-Admin-2026!" };
export const PLAIN_USER = { username: "e2e_user", password: "E2E-User-2026!" };
export const SCOPED_USER = {
  username: "e2e_scoped",
  password: "E2E-Scoped-2026!"
};
/** 数据权限场景：用户列表仅可见本人（种子 DataPermission「E2E-仅本人用户数据」） */
export const DP_USER = { username: "e2e_dp", password: "E2E-DataPerm-2026!" };
/** 字段权限场景：用户列表隐藏邮件列（种子 FieldPermission，角色 e2e_fp） */
export const FP_USER = { username: "e2e_fp", password: "E2E-FieldPer-2026!" };
/** 登录锁定场景专用账号（用例内会连续输错密码） */
export const LOCK_USER = { username: "e2e_lock", password: "E2E-Lock-2026!" };

export type Credentials = { username: string; password: string };

export async function login(page: Page, creds: Credentials = ADMIN) {
  await page.goto("/#/login");
  await page.getByPlaceholder("账号").fill(creds.username);
  await page.getByPlaceholder("密码").fill(creds.password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  // hash 路由：登录成功后离开 #/login
  await expect(page).not.toHaveURL(/#\/login/, { timeout: 15_000 });
}

export async function openMenu(page: Page, parent: string, child: string) {
  await page.getByRole("menuitem", { name: parent }).first().click();
  const item = page.getByRole("menuitem", { name: child }).first();
  await item.waitFor({ state: "visible" });
  await item.click();
}

export async function logout(page: Page) {
  await page.locator(".el-dropdown-link").first().click();
  await page.getByText("退出系统").first().click();
  const confirm = page
    .locator(".el-popconfirm, .el-popper, .el-message-box")
    .getByRole("button", { name: "确定" })
    .first();
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click();
  }
  await expect(page).toHaveURL(/#\/login/, { timeout: 15_000 });
}

/** 从 cookie 读取 access token，供 page.request 越权断言使用（utils/auth.ts 口径） */
export async function getAccessToken(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const tokenCookie = cookies.find(cookie => cookie.name === "X-Token");
  return tokenCookie?.value ?? "";
}
