import { expect, test } from "@playwright/test";

import { login } from "./helpers";

/**
 * OAuth 授权码同意页：第三方发起 → 同意页展示 → 同意回跳携带 code /
 * 拒绝回跳携带 access_denied。
 *
 * 服务端口径（PKCE / 一次性码 / refresh 轮换 / 撤销）由
 * tests/integration/system/test_oauth_authorize.py 钉死。
 */

const CALLBACK = "http://127.0.0.1:19999/cb";

async function createApplication(page, name: string) {
  const created = await page.request.post("/api/system/api-applications", {
    data: { name, callback_urls: [CALLBACK], rate_limit_per_minute: 0 }
  });
  expect(created.ok()).toBeTruthy();
  const body = await created.json();
  return body.data.client_id as string;
}

function authorizeUrl(clientId: string) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: CALLBACK,
    response_type: "code",
    state: "e2e-state"
  });
  return `/#/oauth/authorize?${params.toString()}`;
}

test("OAuth 同意页：同意后回跳携带授权码", async ({ page }) => {
  await login(page);
  const clientId = await createApplication(page, `E2E OAuth ${Date.now()}`);
  // 回跳目标用本地监听端口不可达，拦截请求给一个静态页即可断言 URL
  await page.route(`${CALLBACK}*`, route =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<h1>ok</h1>"
    })
  );

  await page.goto(authorizeUrl(clientId));
  await expect(page.getByTestId("oauth-approve")).toBeVisible({
    timeout: 15_000
  });
  await page.getByTestId("oauth-approve").click();

  await page.waitForURL(/127\.0\.0\.1:19999\/cb\?/, { timeout: 15_000 });
  const url = new URL(page.url());
  expect(url.searchParams.get("state")).toBe("e2e-state");
  expect(url.searchParams.get("code")).toBeTruthy();
  expect(url.searchParams.get("error")).toBeNull();
});

test("OAuth 同意页：拒绝后回跳携带 access_denied", async ({ page }) => {
  await login(page);
  const clientId = await createApplication(
    page,
    `E2E OAuth 拒绝 ${Date.now()}`
  );
  await page.route(`${CALLBACK}*`, route =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<h1>ok</h1>"
    })
  );

  await page.goto(authorizeUrl(clientId));
  await expect(page.getByTestId("oauth-deny")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("oauth-deny").click();

  await page.waitForURL(/127\.0\.0\.1:19999\/cb\?/, { timeout: 15_000 });
  const url = new URL(page.url());
  expect(url.searchParams.get("error")).toBe("access_denied");
  expect(url.searchParams.get("state")).toBe("e2e-state");
});

test("OAuth 同意页：未登记的 redirect_uri 被拒绝", async ({ page }) => {
  await login(page);
  const clientId = await createApplication(
    page,
    `E2E OAuth 非法回跳 ${Date.now()}`
  );
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: "https://evil.example.com/cb",
    response_type: "code"
  });
  await page.goto(`/#/oauth/authorize?${params.toString()}`);
  await expect(
    page.getByText("redirect_uri 未在该应用登记").first()
  ).toBeVisible({
    timeout: 15_000
  });
});
