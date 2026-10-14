import { expect, test, type Page } from "@playwright/test";

import { FRONT_URL } from "./helpers";

/**
 * 验证码重复发送的限流链路：守护 E2E 档进程内缓存后端的 `ttl` 能力。
 *
 * 背景：E2E 档缓存后端（xadmin-server `tests/cache_backend.py::FakeRedisCache`）
 * 缺 `ttl` 时，限流窗口内二次发码在构造 `CodeSendOverRate(cache.ttl(...))` 的
 * 入参求值处抛 AttributeError——后端记 Traceback、前端只显示未预期异常兜底文案。
 * 本用例在真实浏览器链路（登录页 → 忘记密码 → 发码）断言限流响应必须给出
 * **可读的剩余秒提示**，而不是退化成通用错误。
 *
 * 幂等设计：限流键位于后端进程内、窗口为 1000 秒（E2E 档 VERIFY_CODE_LIMIT），
 * 双浏览器与重试场景下本用例可能首发即命中限流——两种情形都只断言「限流响应
 * 可读」，不强求首发成功。专用邮箱取 `e2e_seed.py` 的 E2E 超管邮箱，与
 * `reset-password.e2e.ts` 使用的 xadmin@dvcloud.xin 隔离，互不吃限流窗口。
 */

const RESEND_EMAIL = "e2e_approver@example.com";
const VERIFY_SEND_PATH = "/api/identity/auth/verify";

interface SendCodeResponse {
  status: number;
  text: string;
  code?: number;
}

/** 从登录页切到忘记密码表单并填入专用邮箱 */
async function enterResetForm(page: Page): Promise<void> {
  await page.getByRole("button", { name: /忘记密码/ }).click();
  const emailInput = page.getByPlaceholder(/邮箱|email/i).first();
  await expect(emailInput).toBeVisible({ timeout: 10_000 });
  await emailInput.fill(RESEND_EMAIL);
}

/** 点击「获取验证码」，等发码请求返回并解析响应 */
async function clickSendCode(page: Page): Promise<SendCodeResponse> {
  const [response] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes(VERIFY_SEND_PATH) && r.request().method() === "POST"
    ),
    page
      .getByRole("button", { name: /获取验证码/ })
      .first()
      .click()
  ]);
  const text = await response.text();
  let code: number | undefined;
  try {
    code = (JSON.parse(text) as { code?: number }).code;
  } catch {
    code = undefined;
  }
  return { status: response.status(), text, code };
}

/** 限流响应必须给出可读的剩余秒数，而不是未预期异常的通用兜底文案 */
function expectReadableRateLimit(text: string): void {
  expect(text, `限流响应体：${text}`).toMatch(/\d+\s*(秒|seconds?)/i);
  expect(text, `限流响应不应退化为未预期异常兜底文案：${text}`).not.toContain(
    "Server internal error"
  );
}

test("重复发码：限流窗口内返回可读剩余秒提示", async ({ page }) => {
  test.slow();
  await page.goto(`${FRONT_URL}/#/login`);
  await enterResetForm(page);

  const first = await clickSendCode(page);
  let rateLimited: SendCodeResponse = first;

  if (first.code === 1000) {
    // 首发成功（倒计时启动）：整页重载复原发码按钮（倒计时状态存于内存），
    // 限流窗口内再发必须命中限流
    await expect(
      page.getByRole("button", { name: /获取验证码|\d/ }).last()
    ).toHaveText(/\d/, { timeout: 10_000 });
    await page.reload();
    await enterResetForm(page);
    rateLimited = await clickSendCode(page);
  }

  expectReadableRateLimit(rateLimited.text);
  await expect(page.locator(".el-message--error").first()).toContainText(/\d+/);
});
