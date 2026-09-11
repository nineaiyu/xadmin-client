import { expect, test } from "@playwright/test";

import { FRONT_URL, login } from "./helpers";

/**
 * 第三方登录（OAuth2/OIDC）边界：无真实 IdP 环境下只断言「未配置即整体休眠」
 * 与接口的可读错误，不伪造外部 IdP（真实流程由后端单测以注入的 stub 客户端覆盖）。
 */

test("未配置 provider：登录页不显示第三方入口", async ({ page }) => {
  await page.goto(`${FRONT_URL}/#/login`);
  await expect(page.getByPlaceholder("账号")).toBeVisible({
    timeout: 15_000
  });
  // OAUTH_PROVIDERS 默认空：入口整块不渲染（登录页原有的静态第三方图标区不受影响）
  await expect(page.locator(".oauth-entry")).toHaveCount(0);
});

test("未配置 provider：authorize 返回可读业务错误", async ({ page }) => {
  await login(page);
  const resp = await page.request.get(
    `${FRONT_URL}/api/system/auth/oauth/stub-idp/authorize`
  );
  const body = await resp.json();
  expect(body.code).toBe(1006);
  expect(body.detail).toBeTruthy();
});

test("个人中心：第三方账号页签可见且为空态", async ({ page }) => {
  await login(page);
  await page.goto("/#/account-settings");
  await expect(page.getByText("第三方账号").first()).toBeVisible({
    timeout: 15_000
  });
  await page.getByText("第三方账号").first().click();
  await expect(page.getByText("暂无第三方账号绑定").first()).toBeVisible({
    timeout: 15_000
  });
});
