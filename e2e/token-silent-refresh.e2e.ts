import { expect, test } from "@playwright/test";

import { login, openUserManagement } from "./helpers";

/**
 * token 无感刷新：401 + 业务码 40001 → 静默换新 access → 原请求重发成功，
 * 页面无感（不跳登录、列表正常渲染）。链路：tokenExpiredStrategy 清 access
 * 后重发（reissue）→ 请求拦截器发现无 access 且有 refresh → 单飞刷新
 * （POST /api/identity/refresh）→ 排队请求带新 token 重试。
 *
 * 可行性口径（报告 14 缺口 G-05）：真实过期时刻 E2E 无法控制（需后端签发
 * 短时 token），改用请求拦截把首个用户列表请求一次性改写为 401/40001——
 * 纯前端可测，真实刷新接口、真实会话轮换；其后放行原请求。
 * 若无感刷新链路断裂，表格渲染不出来或被踢回登录页。
 */
test("列表请求 401(40001)：静默刷新后原请求重发，页面无感", async ({
  page
}) => {
  await login(page);

  let expiredOnce = false;
  await page.route("**/api/identity/user?**", async route => {
    if (expiredOnce) {
      await route.fallback();
      return;
    }
    expiredOnce = true;
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ code: 40001, detail: "令牌无效或已过期" })
    });
  });

  // 刷新接口被调用（经应用 axios 链路的真实刷新，非测试直调）
  const refreshCalled = page.waitForResponse(
    response =>
      response.url().includes("/api/identity/refresh") &&
      response.request().method() === "POST",
    { timeout: 20_000 }
  );

  await openUserManagement(page);

  const refresh = await refreshCalled;
  expect(refresh.ok()).toBeTruthy();

  // 页面无感：未被踢回登录页，列表数据经重发后正常渲染
  await expect(page).not.toHaveURL(/#\/login/);
  await expect(page.locator(".el-table__row").first()).toBeVisible({
    timeout: 15_000
  });
});
