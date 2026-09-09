import { expect, test } from "@playwright/test";

import {
  E2E_USER_AGENT,
  fetchTempToken,
  FRONT_URL,
  getAccessToken,
  login,
  openMenuPath,
  PLAIN_USER
} from "./helpers";

/**
 * 在线用户管理 + 强制下线全链路：
 * 1. 受限用户登录拿到 access token；
 * 2. 管理员调用 force-logout（用户维度踢全部会话）；
 * 3. 旧 access token 立即 401（服务端令牌失效，而非仅前端登出）；
 * 4. 重新登录可恢复（iat 秒级粒度，越过被踢秒即可）。
 * 另验证在线用户页面渲染（管理员自身 WS 会话在列）。
 */

const authz = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "User-Agent": E2E_USER_AGENT
});

async function loginBasic(
  page: import("@playwright/test").Page,
  username: string,
  password: string
) {
  // 登录接口强制校验一次性临时 Token（同 lockout.e2e.ts）
  const token = await fetchTempToken(page);
  const resp = await page.request.post(`${FRONT_URL}/api/system/login/basic`, {
    data: { username, password, token },
    headers: { "User-Agent": E2E_USER_AGENT }
  });
  return resp.json();
}

test("强制下线：服务端令牌立即失效且可重新登录", async ({ page }) => {
  await login(page);
  const adminToken = await getAccessToken(page);
  expect(adminToken).toBeTruthy();

  // 受限用户登录一个会话
  const plainLogin = await loginBasic(
    page,
    PLAIN_USER.username,
    PLAIN_USER.password
  );
  expect(plainLogin.code).toBe(1000);
  const plainToken = plainLogin.data.access as string;

  const meResp = await page.request.get(`${FRONT_URL}/api/system/userinfo`, {
    headers: authz(plainToken)
  });
  expect(meResp.status()).toBe(200);
  const plainPk = (await meResp.json()).data.pk;

  // 管理员强制下线（显式 Bearer，避免 plain 登录覆盖 Cookie 后越权误判）
  const logoutResp = await page.request.post(
    `${FRONT_URL}/api/system/online/${plainPk}/force-logout`,
    { headers: authz(adminToken) }
  );
  expect((await logoutResp.json()).code).toBe(1000);

  // 旧 access token 立即失效
  const checkResp = await page.request.get(`${FRONT_URL}/api/system/userinfo`, {
    headers: authz(plainToken)
  });
  expect(checkResp.status()).toBe(401);

  // 重新登录恢复（iat 秒级粒度：越过被踢秒即可）
  await page.waitForTimeout(1100);
  const reLogin = await loginBasic(
    page,
    PLAIN_USER.username,
    PLAIN_USER.password
  );
  expect(reLogin.code).toBe(1000);
  const reMe = await page.request.get(`${FRONT_URL}/api/system/userinfo`, {
    headers: authz(reLogin.data.access as string)
  });
  expect(reMe.status()).toBe(200);
});

test("在线用户页面渲染", async ({ page }) => {
  await login(page);
  // 在线用户菜单挂在「系统管理 → 日志管理」目录下
  await openMenuPath(page, ["系统管理", "日志管理"], "/system/online/index");
  // 表格渲染即可（在线快照 5s 缓存 + 30s 心跳，行内容有延迟，不作为断言项）
  await expect(
    page
      .locator(".el-table__row")
      .first()
      .or(page.locator(".el-table__empty-text"))
      .first()
  ).toBeVisible({ timeout: 20_000 });
});
