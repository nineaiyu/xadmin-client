import { expect, test, type Page } from "@playwright/test";

import { BACKEND_URL, FRONT_URL, getAccessToken, login } from "./helpers";

/**
 * 忘记密码链路 E2E（免登页 → 重置表单 → 发码 → 错误验证码拒绝）。
 *
 * 覆盖范围：免登路由装配、验证码配置（category=reset）、发送接口、
 * 服务端校验失败在前端的可读呈现。验证码值经邮件渠道投递（E2E 为 locmem
 * 后端，停留在服务端进程内），**成功重置分支无法在浏览器内闭环**——该分支
 * 的全部分支逻辑（LDAP 拒绝 / 弱口令 / 泄露口令 / 历史口令 / v2 密文协议）
 * 由 xadmin-server tests/integration/system/test_password_reset_api.py 覆盖。
 *
 * 依赖 tests.settings_e2e：SECURITY_RESET_PASSWORD_CAPTCHA_ENABLED=False
 * （图片验证码无法自动识别；验证码「值」的发送与校验仍走真实链路）。
 *
 * 目标邮箱每次尝试都唯一：E2E 档 VERIFY_CODE_LIMIT=1000s 按目标邮箱计数，
 * chromium / webkit 以及重试共用同一后端进程，固定邮箱会让第二个浏览器阶段
 * 稳定命中 429（「请在 968 秒后发送」），按钮永远进不了倒计时。
 */

/** 点击「获取验证码」后按钮进入倒计时（按钮文案出现数字） */
async function expectCountdown(page: Page): Promise<void> {
  const sendButton = page.getByRole("button", { name: /获取验证码|\d/ }).last();
  await expect(sendButton).toBeVisible();
  await expect(sendButton).toHaveText(/\d/, { timeout: 10_000 });
}

/** 建一个本次尝试专用的在用用户（唯一邮箱），返回重置链路所需信息 */
async function createResetTarget(page: Page) {
  await login(page);
  const token = await getAccessToken(page);
  const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const username = `e2e_reset_${suffix}`;
  const email = `${username}@example.com`;
  const res = await page.request.post(`${BACKEND_URL}/api/identity/user`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      username,
      nickname: "E2E重置密码",
      email,
      password: "E2E-Reset-2026!"
    }
  });
  const body = await res.json().catch(() => ({}));
  expect(res.ok(), JSON.stringify(body)).toBeTruthy();
  expect(body.code, JSON.stringify(body)).toBe(1000);
  return { email, token, pk: body.data?.pk as number | string };
}

test("忘记密码：入口 → 发送验证码 → 错误验证码提交被拒", async ({ page }) => {
  const target = await createResetTarget(page);
  try {
    // 建号后回到未登录态：清凭据并整页重载，避免路由守卫把登录页重定向回首页
    await page.context().clearCookies();
    await page.goto(`${FRONT_URL}/#/login`);
    await expect(page.getByPlaceholder(/密码|password/i).first()).toBeVisible({
      timeout: 15_000
    });

    // 登录页 → 忘记密码表单（站点配置默认允许自助重置）
    await page.getByRole("button", { name: /忘记密码/ }).click();
    const emailInput = page.getByPlaceholder(/邮箱|email/i).first();
    await expect(emailInput).toBeVisible({ timeout: 10_000 });

    // 发送验证码：倒计时启动 = 发送接口成功 + verify_token 已回填（密码框出现）
    await emailInput.fill(target.email);
    await page
      .getByRole("button", { name: /获取验证码/ })
      .first()
      .click();
    await expectCountdown(page);
    await expect(page.getByPlaceholder(/密码|password/i).first()).toBeVisible({
      timeout: 10_000
    });

    // 错误验证码：服务端校验拒绝并以错误消息呈现（不进入成功回跳）
    await page
      .getByPlaceholder(/验证码|verify/i)
      .first()
      .fill("000000");
    await page
      .getByPlaceholder(/密码|password/i)
      .first()
      .fill("NewStrong@2026");
    await page
      .getByPlaceholder(/密码|password/i)
      .nth(1)
      .fill("NewStrong@2026");
    await page.getByRole("button", { name: /确定/ }).last().click();
    await expect(page.locator(".el-message--error").first()).toBeVisible({
      timeout: 10_000
    });
    // 仍在重置表单（未回登录页）
    await expect(emailInput).toBeVisible();

    // 返回登录：重置页「返回」按钮回到账户密码登录
    await page.getByRole("button", { name: /返回/ }).last().click();
    await expect(
      page.getByRole("button", { name: /登录|login/i }).first()
    ).toBeVisible({
      timeout: 10_000
    });
  } finally {
    await page.request
      .delete(`${BACKEND_URL}/api/identity/user/${target.pk}`, {
        headers: { Authorization: `Bearer ${target.token}` }
      })
      .catch(() => undefined);
  }
});
