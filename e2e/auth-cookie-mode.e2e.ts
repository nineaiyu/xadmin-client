import { expect, test, type Page } from "@playwright/test";

import { ADMIN, FRONT_URL, loginWithForm, logout } from "./helpers";

/**
 * 认证承载模式回归（服务端 AUTH_COOKIE_HTTPONLY 开关的浏览器面守护）。
 *
 * 双模式自探测：读取 capabilities 的 auth_transport 投影，header 档跑「默认模式」
 * 断言组（响应体 token + JS 可读 Cookie + 标记一致性）；cookie 档跑 HttpOnly 全链路
 * （登录 → Cookie 属性 → 刷新保会话 → 401 轮换 → CSRF 拦截 → 登出清理）。
 *
 * 默认全量批（header 栈）永远执行前两个用例——守护「默认模式零回归」；
 * cookie 档需要「开关就位的栈」：E2E 进程内 FakeRedis 拿不到外部进程的 Setting
 * 热更广播，开关经环境变量注入后端（`AUTH_COOKIE_HTTPONLY=true` 起后端进程），
 * 复现步骤与两组真实结果见工作区 `docs/audit/2026-11-04-acceptance.md`。
 */

type AuthTransport = "header" | "cookie";

/** 当前栈的认证承载模式（capabilities 只读投影，与后端开关同源） */
async function authTransport(page: Page): Promise<AuthTransport> {
  const resp = await page.request.get(
    `${FRONT_URL}/api/identity/auth/capabilities`
  );
  const body = (await resp.json().catch(() => ({}))) as {
    data?: { auth_transport?: AuthTransport };
  };
  const transport = body?.data?.auth_transport;
  if (transport !== "header" && transport !== "cookie") {
    throw new Error(
      `auth_transport 投影异常：${JSON.stringify(body).slice(0, 200)}`
    );
  }
  return transport;
}

/** 临时令牌 + 密码登录（API 面；与 helpers 会话取号同构，但拿得到原始响应） */
async function apiLogin(page: Page) {
  const headers = { "User-Agent": "e2e-test", Accept: "application/json" };
  const tempResp = await page.request.get(
    `${FRONT_URL}/api/identity/auth/token`,
    {
      headers
    }
  );
  const tempToken = (
    (await tempResp.json().catch(() => ({}))) as {
      token?: string;
      data?: { token?: string };
    }
  )?.token;
  if (!tempToken)
    throw new Error(`临时令牌获取失败：HTTP ${tempResp.status()}`);
  return page.request.post(`${FRONT_URL}/api/identity/login/basic`, {
    headers,
    data: {
      username: ADMIN.username,
      password: ADMIN.password,
      token: tempToken
    }
  });
}

test("认证模式：标记 Cookie 与 capabilities 投影一致，token 承载位置符合档位", async ({
  page
}) => {
  const transport = await authTransport(page);
  await page.context().clearCookies();
  const resp = await apiLogin(page);
  expect(resp.ok(), await resp.text()).toBeTruthy();
  const body = (await resp.json()) as {
    data?: { access?: string; refresh?: string };
  };
  const setCookie = (await resp.headersArray())
    .filter(h => h.name.toLowerCase() === "set-cookie")
    .map(h => h.value)
    .join("\n");
  const cookies = await page.context().cookies();

  if (transport === "cookie") {
    // HttpOnly 档：响应体键保留值剥离；token 只经 Set-Cookie 下发且带 HttpOnly
    expect(body?.data?.access ?? "").toBe("");
    expect(
      setCookie,
      `Set-Cookie 应含 HttpOnly 的 X-Token：\n${setCookie}`
    ).toContain("X-Token=");
    expect(setCookie).toContain("HttpOnly");
    expect(cookies.some(c => c.name === "X-Token" && c.httpOnly)).toBe(true);
  } else {
    // header 档（默认）：token 在响应体；服务端不下发 token Cookie（仅模式标记）
    expect(body?.data?.access ?? "").not.toBe("");
    expect(cookies.some(c => c.name === "X-Token")).toBe(false);
  }
  // 两档位都随登录下发 JS 可读的模式标记，且与 capabilities 投影一致
  const marker = cookies.find(c => c.name === "X-Auth-Mode");
  expect(marker?.value).toBe(transport);
  expect(marker?.httpOnly ?? false).toBe(false);
});

test("认证模式：真实表单登录后应用壳可用，JS 侧 token 可见性符合档位", async ({
  page
}) => {
  const transport = await authTransport(page);
  await loginWithForm(page);
  await expect(page.locator("#header-translation")).toBeVisible({
    timeout: 15_000
  });
  const jsCookie = await page.evaluate(() => document.cookie);
  if (transport === "cookie") {
    // HttpOnly：document.cookie 看不到 token（XSS 窃取面收敛）；会话标记仍可读
    expect(jsCookie).not.toContain("X-Token=");
    expect(jsCookie).not.toContain("X-Refresh-Token=");
  } else {
    expect(jsCookie).toContain("X-Token=");
  }
  await logout(page);
});

test("HttpOnly 全链路：刷新保会话 / 401 轮换 / CSRF 拦截 / 登出清理", async ({
  page
}) => {
  const transport = await authTransport(page);
  test.skip(
    transport !== "cookie",
    "HttpOnly 档守护：需要 AUTH_COOKIE_HTTPONLY=true 的栈"
  );

  await loginWithForm(page);
  await expect(page.locator("#header-translation")).toBeVisible({
    timeout: 15_000
  });

  // Cookie 属性：HttpOnly + SameSite=Lax；标记可读
  const cookies = await page.context().cookies();
  const access = cookies.find(c => c.name === "X-Token");
  const refresh = cookies.find(c => c.name === "X-Refresh-Token");
  expect(access?.httpOnly).toBe(true);
  expect(access?.sameSite).toBe("Lax");
  expect(refresh?.httpOnly).toBe(true);

  // 刷新保会话：整页重载后 HttpOnly Cookie 仍在（JS 删不掉），会话保持
  await page.reload();
  await expect(page.locator("#header-translation")).toBeVisible({
    timeout: 15_000
  });

  // 401 → 单飞刷新 → Cookie 轮换重下：删掉 access Cookie（Playwright 可改，JS 不可）
  // 覆盖「access Cookie 自然过期消失（缺凭证 code=401）+ refresh 仍有效」的真实形态
  await page.context().clearCookies({ name: "X-Token" });
  await page.reload();
  await expect(page.locator("#header-translation")).toBeVisible({
    timeout: 30_000
  });
  const rotatedRefresh =
    (await page.context().cookies()).find(c => c.name === "X-Refresh-Token")
      ?.value ?? "";
  const rotated = (await page.context().cookies()).find(
    c => c.name === "X-Token"
  );
  expect(rotated?.httpOnly).toBe(true);

  // CSRF 拦截：同源请求携带浏览器 Cookie 凭证（轮换后的 refresh 有效）+ 伪造跨站
  // Origin 刷新 → 403（凭证有效却被拒，只能是 Origin 兜底命中；同源放行已由上面轮换覆盖）
  const csrf = await page.request.post(`${FRONT_URL}/api/identity/refresh`, {
    headers: { Origin: "http://cross-origin-attacker.example" },
    data: {}
  });
  expect(csrf.status()).toBe(403);

  // 登出：三条认证 Cookie 由服务端 Max-Age=0 清理
  await logout(page);
  const after = await page.context().cookies();
  expect(after.some(c => c.name === "X-Token")).toBe(false);
  expect(after.some(c => c.name === "X-Refresh-Token")).toBe(false);

  // 登出前轮换出的 refresh 已被服务端拉黑：即使把值塞回 Cookie 再刷新也是 401
  await page
    .context()
    .addCookies([
      { name: "X-Refresh-Token", value: rotatedRefresh, url: FRONT_URL }
    ]);
  const revoked = await page.request.post(`${FRONT_URL}/api/identity/refresh`, {
    data: {}
  });
  expect(revoked.status()).toBe(401);
});
