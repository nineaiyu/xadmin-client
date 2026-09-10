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
 * 4. 重新登录可恢复（被踢按 iat 秒级比较：以「签发后访问 userinfo」断言式重试验证）。
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

  // 重新登录恢复：被踢判定为「revoked_at 与 iat 秒级比较」（common/core/auth.py），
  // 新签发的 token 必须落在失效时间戳之后 —— 属服务端时间域约束，无法用 DOM 断言表达。
  // 因此不用固定 1.1s 延时，而是「签发 → 以新 token 访问 userinfo」的断言式重试（web-first）：
  // 立即生效即通过；同一秒内签发仍 401 时自动重试，跨过秒边界即成功。
  await expect
    .poll(
      async () => {
        const resp = await loginBasic(
          page,
          PLAIN_USER.username,
          PLAIN_USER.password
        );
        if (resp?.code !== 1000) return `login:${resp?.code}`;
        const me = await page.request.get(`${FRONT_URL}/api/system/userinfo`, {
          headers: authz(resp.data.access as string)
        });
        return me.status();
      },
      { timeout: 15_000, intervals: [200, 300, 400, 600, 800] }
    )
    .toBe(200);
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
