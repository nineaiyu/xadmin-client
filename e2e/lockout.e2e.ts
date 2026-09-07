import { expect, test } from "@playwright/test";

import {
  E2E_USER_AGENT,
  FRONT_URL,
  LOCK_USER,
  PLAIN_USER,
  fetchTempToken,
  login
} from "./helpers";

/**
 * 登录锁定路径 E2E：连续失败达到 SECURITY_LOGIN_LIMIT_COUNT（E2E 环境=50）
 * 后账号被锁，正确密码也被拒绝。
 * settings_e2e 已将 IP 限流放宽，避免本机 IP 被连带封禁影响其他用例。
 */

const LOGIN_API = `${FRONT_URL}/api/system/login/basic`;

async function wrongLogin(page: import("@playwright/test").Page) {
  // 登录接口强制校验一次性临时 Token（system/utils/auth.py::check_tmp_token）：
  // 缺 token 会命中「临时Token校验失败」，压根走不到失败计数/锁定判定逻辑
  const token = await fetchTempToken(page);
  return page.request.post(LOGIN_API, {
    data: {
      username: LOCK_USER.username,
      password: `wrong-${Math.random().toString(36).slice(2)}`,
      token
    },
    headers: { "User-Agent": E2E_USER_AGENT }
  });
}

test("连续失败达到阈值后，API 返回锁定提示", async ({ page }) => {
  test.setTimeout(120_000);
  let lockedDetail = "";
  // 阈值 50：循环至多 70 次。注意只能匹配 /已被锁定/——失败计数控的
  // 「您还可以尝试 N 次 (账号将被临时 锁定 30 分钟)」同样含「锁定」二字，
  // 宽泛匹配会在第 1 次失败就误判为已锁定
  for (let i = 0; i < 70 && !lockedDetail; i++) {
    const response = await wrongLogin(page);
    const payload = await response.json().catch(() => null);
    const detail: string = payload?.detail ?? "";
    if (/已被锁定/.test(detail)) {
      lockedDetail = detail;
    }
  }
  expect(lockedDetail).not.toBe("");
});

test("账号锁定后，界面正确密码登录同样被拒并提示锁定", async ({ page }) => {
  test.setTimeout(120_000);
  // 确保账号处于真正的锁定态（前一个用例可能尚未跑：补足失败次数）
  for (let i = 0; i < 60; i++) {
    const response = await wrongLogin(page);
    const payload = await response.json().catch(() => null);
    if (/已被锁定/.test(payload?.detail ?? "")) {
      break;
    }
  }

  await page.goto("/#/login");
  await page.getByPlaceholder("账号").fill(LOCK_USER.username);
  await page.getByPlaceholder("密码").fill(LOCK_USER.password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(
    page.locator(".el-message, .el-notification").getByText(/锁定/).first()
  ).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/#\/login/);
});

test("对照：正常账号不受锁定影响", async ({ page }) => {
  await login(page, PLAIN_USER);
  await expect(page).not.toHaveURL(/#\/login/);
});
