import { expect, test } from "@playwright/test";

import { FRONT_URL, login, logout } from "./helpers";

/**
 * 第三方登录（OAuth2/OIDC）边界：无真实 IdP 环境下只断言「配置即入口、
 * 清空即休眠」与接口的可读错误，不伪造外部 IdP（真实流程由后端单测以
 * 注入的 stub 客户端覆盖）。
 *
 * E2E 种子默认注入启用态 feishu flavor provider（oauth-im.e2e.ts 依赖入口可见），
 * 「休眠」前提需在用例内把配置清空后断言，结束时还原种子值。
 */

test("provider 配置清空：登录页第三方入口整体休眠", async ({ page }) => {
  await login(page);
  const configUrl = `${FRONT_URL}/api/system/config/system`;
  const listResp = await page.request.get(`${configUrl}?key=OAUTH_PROVIDERS`);
  const listBody = await listResp.json();
  const rows = listBody?.data?.results ?? [];
  const row = Array.isArray(rows)
    ? rows.find(item => item.key === "OAUTH_PROVIDERS")
    : undefined;
  if (!row) {
    // 无任何配置（等同未配置）：入口整块不渲染
    await logout(page);
    await page.goto(`${FRONT_URL}/#/login`);
    await expect(page.getByPlaceholder("账号")).toBeVisible({
      timeout: 15_000
    });
    await expect(page.locator(".oauth-entry")).toHaveCount(0);
    return;
  }

  const patch = (value: unknown) =>
    page.request.patch(`${configUrl}/${row.pk}`, { data: { value } });
  // SystemConfig post_save 信号即时失效 SysConfig 缓存，清空即时生效
  await patch([]);
  await logout(page);
  await page.goto(`${FRONT_URL}/#/login`);
  await expect(page.getByPlaceholder("账号")).toBeVisible({
    timeout: 15_000
  });
  await expect(page.locator(".oauth-entry")).toHaveCount(0);

  // 还原种子配置（同 shard 后续/并行的入口可见用例依赖它）
  await login(page);
  await patch(row.value);
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

test("个人中心：第三方账号页签展示空态与绑定入口", async ({ page }) => {
  await login(page);
  await page.goto("/#/account-settings");
  await expect(page.getByText("第三方账号").first()).toBeVisible({
    timeout: 15_000
  });
  await page.getByText("第三方账号").first().click();
  await expect(page.getByText("暂无第三方账号绑定").first()).toBeVisible({
    timeout: 15_000
  });
  // 种子注入的启用态 provider（E2E飞书）出现在「可绑定」区，带绑定入口
  const providerRow = page
    .locator(".provider-row", { hasText: "E2E飞书" })
    .first();
  await expect(providerRow).toBeVisible({ timeout: 15_000 });
  await expect(providerRow.getByRole("button", { name: "绑定" })).toBeVisible();
});

test("个人中心：绑定授权地址可取（已登录 + 带 state）", async ({ page }) => {
  await login(page);
  const resp = await page.request.get(
    `${FRONT_URL}/api/system/auth/oauth/feishu/bind-authorize`
  );
  const body = await resp.json();
  expect(body.code).toBe(1000);
  // 返回 IdP 授权地址与一次性 state（真实绑定跳转依赖真实 IdP，由后端 stub 单测覆盖）
  expect(String(body.data.url)).toContain("https://");
  expect(String(body.data.state)).toBeTruthy();
});
