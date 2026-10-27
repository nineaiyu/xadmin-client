/**
 * 风险分级 E2E：enforce 档的无题直过与 light（PoW 点击）路径。
 *
 * 配置经设置端点热更，用例幂等：结束后恢复 off + image + 登录验证码关闭。
 * 仅 chromium/webkit 双浏览器跑，依赖 tests/settings_e2e.py 的 RISK_MODE=off 基线。
 */

import { createHash, createHmac, randomBytes } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Cookie, type Page } from "@playwright/test";

import { FRONT_URL, login, loginWithForm } from "./helpers";

const ENV = {
  v: 1,
  timezone: "Asia/Shanghai",
  language: "zh-CN",
  screen: { width: 1920, height: 1080, dpr: 1 }
};

function verifySign(
  ck: string,
  challengeId: string,
  type: string,
  answer: unknown,
  genTime: number
) {
  const digest = createHash("sha256")
    .update(JSON.stringify(answer))
    .digest("hex");
  const canonical = [challengeId, type, "login", digest, String(genTime)].join(
    "|"
  );
  return createHmac("sha256", ck).update(canonical).digest("hex");
}

async function postJson(
  page: Page,
  path: string,
  data: object,
  headers: Record<string, string> = {}
) {
  return page.request.post(`${FRONT_URL}${path}`, { data, headers });
}

// 非 Chrome UA：避免 ua_mismatch（请求不带 sec-ch-ua）把分数推到 deny，
// 保证本用例只验证「阶梯强制难题」这一条规则。
const PLAIN_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36";
const PLAIN_HEADERS = { "User-Agent": PLAIN_UA };

async function patchSetting(page: Page, path: string, data: object) {
  const resp = await page.request.patch(`${FRONT_URL}${path}`, { data });
  expect(resp.ok(), `${path} PATCH ${resp.status()}`).toBeTruthy();
}

async function waitForFlow(page: Page, flow: "always" | "adaptive") {
  await expect
    .poll(
      async () => {
        const resp = await page.request.get(
          `${FRONT_URL}/api/identity/auth/capabilities`
        );
        const body = await resp.json().catch(() => ({}));
        return body?.data?.basic?.captcha_flow;
      },
      { timeout: 15_000 }
    )
    .toBe(flow);
}

async function configure(page: Page, risk: object) {
  await patchSetting(page, "/api/settings/captcha/general", {
    CAPTCHA_ENABLED: true,
    CAPTCHA_MODE: "interactive"
  });
  await patchSetting(page, "/api/settings/captcha/interactive", {
    CAPTCHA_INTERACTIVE_TYPES: ["slide", "rotate", "click", "wordorder"],
    CAPTCHA_TRACK_CHECK_ENABLED: true
  });
  await patchSetting(page, "/api/settings/login/auth", {
    SECURITY_LOGIN_CAPTCHA_ENABLED: true
  });
  await patchSetting(page, "/api/settings/captcha/risk", risk);
  await waitForFlow(page, "adaptive");
}

async function restore(page: Page) {
  await patchSetting(page, "/api/settings/captcha/risk", {
    CAPTCHA_RISK_MODE: "off",
    CAPTCHA_RISK_TRUST_PRIVATE_NETWORKS: true,
    CAPTCHA_RISK_T_ALLOW: 20,
    CAPTCHA_RISK_T_LIGHT: 40,
    CAPTCHA_RISK_T_HARD: 70,
    CAPTCHA_RISK_T_DENY: 90,
    CAPTCHA_FAIL_STEP: "3,8,20"
  });
  await patchSetting(page, "/api/settings/captcha/general", {
    CAPTCHA_ENABLED: true,
    CAPTCHA_MODE: "image"
  });
  await patchSetting(page, "/api/settings/login/auth", {
    SECURITY_LOGIN_CAPTCHA_ENABLED: false
  });
  await waitForFlow(page, "always");
}

test.describe("验证码风险分级 enforce", () => {
  let adminCookies: Cookie[] = [];

  test.beforeEach(async ({ page }) => {
    await login(page);
    adminCookies = await page.context().cookies();
  });

  test.afterEach(async ({ page }) => {
    await page.context().addCookies(adminCookies);
    await restore(page).catch(() => undefined);
  });

  test("可信网段：enforce 下无题直过登录", async ({ page }) => {
    await configure(page, {
      CAPTCHA_RISK_MODE: "enforce",
      CAPTCHA_RISK_TRUST_PRIVATE_NETWORKS: true
    });

    await loginWithForm(page);
    await expect(page.locator(".el-menu").first()).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByTestId("captcha-panel")).toHaveCount(0);
  });

  test("失败阶梯：连续失败后下一题强制难题型", async ({ page }) => {
    await configure(page, {
      CAPTCHA_RISK_MODE: "enforce",
      CAPTCHA_RISK_TRUST_PRIVATE_NETWORKS: false,
      CAPTCHA_FAIL_STEP: "1,8,20"
    });

    const riskyEnv = { ...ENV, webdriver: true, timezone: "Not/AZone" };
    const first = await postJson(
      page,
      "/api/identity/auth/captcha/challenge",
      {
        scene: "login",
        action: "identity.login.basic",
        env: riskyEnv
      },
      PLAIN_HEADERS
    );
    expect(first.ok()).toBeTruthy();
    const firstData = (await first.json()).data;
    expect(firstData.decision).toBe("hard");
    expect(firstData.type).toBe("wordorder");

    const answer = { points: [] };
    const genTime = Math.floor(Date.now() / 1000);
    const body: Record<string, unknown> = {
      challenge_id: firstData.challenge_id,
      type: firstData.type,
      scene: "login",
      answer,
      action: "identity.login.basic",
      env: riskyEnv,
      gen_time: genTime,
      nonce: randomBytes(16).toString("hex")
    };
    if (firstData.ck) {
      body.sign = verifySign(
        firstData.ck,
        firstData.challenge_id,
        firstData.type,
        answer,
        genTime
      );
    }
    const failed = await postJson(
      page,
      "/api/identity/auth/captcha/verify",
      body,
      PLAIN_HEADERS
    );
    expect(failed.ok()).toBeTruthy();
    expect((await failed.json()).data.passed).toBe(false);

    // 干净环境本身是 0 分（allow）；阶梯第一档必须把它抬成 hard
    const next = await postJson(
      page,
      "/api/identity/auth/captcha/challenge",
      {
        scene: "login",
        action: "identity.login.basic",
        env: ENV
      },
      PLAIN_HEADERS
    );
    expect(next.ok()).toBeTruthy();
    const nextData = (await next.json()).data;
    expect(nextData.decision).toBe("hard");
    expect(nextData.type).toBe("wordorder");
  });

  test("light：点击验证完成 PoW 后登录", async ({ page }) => {
    await configure(page, {
      CAPTCHA_RISK_MODE: "enforce",
      CAPTCHA_RISK_TRUST_PRIVATE_NETWORKS: false,
      // 无头浏览器的 webdriver / UA 信号可到 ~85 分；把 light 区间放宽到 86
      CAPTCHA_RISK_T_ALLOW: 0,
      CAPTCHA_RISK_T_LIGHT: 86,
      CAPTCHA_RISK_T_HARD: 87,
      CAPTCHA_RISK_T_DENY: 88,
      CAPTCHA_POW_ENABLED: true,
      CAPTCHA_POW_BITS_LIGHT: 4
    });

    // 零第三方外发：记录登录 + 验证码链路的所有 HTTP(S) 请求
    const external: string[] = [];
    const allowedHosts = new Set([
      new URL(FRONT_URL).hostname,
      "localhost",
      "127.0.0.1"
    ]);
    page.on("request", request => {
      try {
        const url = new URL(request.url());
        if (
          ["http:", "https:"].includes(url.protocol) &&
          !allowedHosts.has(url.hostname)
        ) {
          external.push(request.url());
        }
      } catch {
        // 忽略非标准 URL
      }
    });
    // loginWithForm 会等登录完成；这里并行等待 PoW 面板出现并点击
    const submitPromise = loginWithForm(page).catch(() => undefined);
    await expect(page.getByTestId("captcha-pow")).toBeVisible({
      timeout: 15_000
    });
    // 无障碍：验证码浮层（PoW 路径）无 critical/serious 违规
    await page.waitForTimeout(500);
    const a11y = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const blocking = a11y.violations.filter(violation =>
      ["critical", "serious"].includes(violation.impact ?? "")
    );
    expect(blocking, JSON.stringify(blocking.map(item => item.id))).toEqual([]);
    await page.getByTestId("captcha-pow-solve").click();
    await submitPromise;
    await expect(page.locator(".el-menu").first()).toBeVisible({
      timeout: 30_000
    });
    expect(external, external.join(",")).toEqual([]);
  });
});

test("验证码设置页：风险策略页签渲染配置与规则表", async ({ page }) => {
  await login(page);
  await page.goto("/#/settings/captcha");
  await page.getByRole("tab", { name: "风险策略", exact: true }).click();
  await expect(page.getByTestId("captcha-risk-rules")).toBeVisible({
    timeout: 15_000
  });
  await expect(page.getByTestId("captcha-risk-rules-save")).toBeVisible();
  await expect(page.getByTestId("captcha-risk-compliance")).toBeVisible();
  await expect(page.getByText("env_headless").first()).toBeVisible();
});
