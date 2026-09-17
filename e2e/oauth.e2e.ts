import { expect, test, type APIRequestContext } from "@playwright/test";

import { FRONT_URL, login } from "./helpers";

/**
 * 第三方登录（OAuth2/OIDC）边界：无真实 IdP 环境下只断言「配置即入口、
 * 清空即休眠」与接口的可读错误，不伪造外部 IdP（真实流程由后端单测以
 * 注入的 stub 客户端覆盖）。
 *
 * E2E 种子默认注入启用态 feishu flavor provider（oauth-im.e2e.ts 依赖入口可见），
 * 「休眠」前提需在用例内把配置清空后断言，结束时还原种子值。
 */

const CONFIG_API = `${FRONT_URL}/api/system/config/system`;

/**
 * 与 xadmin-server scripts/e2e_seed.py::seed_oauth_im_provider 保持一致的种子值。
 * 还原必须无条件写回该固定值，不能写「运行时读到的当前值」：清空后用例一旦中途
 * 失败（断言/登录超时），当前值已是空数组，被当原值写回会把空配置永久留给后续
 * 用例（历史事故：「E2E飞书 行不可见」「bind-authorize 非 1000」连锁失败，
 * 且重试也无法恢复——重试读到的「原值」同样是空）。
 */
const OAUTH_SEED_PROVIDERS = [
  {
    key: "feishu",
    name: "E2E飞书",
    flavor: "feishu",
    client_id: "cli_e2e",
    client_secret: "sec_e2e",
    enabled: true
  }
];

/** 读取 OAUTH_PROVIDERS 配置行（未配置时返回 undefined） */
async function findProvidersRow(request: APIRequestContext) {
  const resp = await request.get(`${CONFIG_API}?key=OAUTH_PROVIDERS`);
  const rows = (await resp.json())?.data?.results ?? [];
  return Array.isArray(rows)
    ? rows.find(item => item.key === "OAUTH_PROVIDERS")
    : undefined;
}

test.afterEach(async ({ page }) => {
  // 接口兜底还原（幂等）：无论用例成功失败，都把 provider 配置写回种子值，
  // 避免清空态泄漏给同 shard 的后续用例
  try {
    const row = await findProvidersRow(page.request);
    if (row) {
      await page.request.patch(`${CONFIG_API}/${row.pk}`, {
        data: { value: OAUTH_SEED_PROVIDERS }
      });
    }
  } catch {
    // 兜底失败不掩盖用例本身的失败原因
  }
});

test("provider 配置清空：登录页第三方入口整体休眠", async ({
  page,
  browser
}) => {
  await login(page);
  const row = await findProvidersRow(page.request);
  // 匿名上下文访问登录页断言入口休眠：不依赖「登出 → 重新登录」链路
  // （该链路自身会引入登录超时，且失败时把配置留在清空态），同时天然覆盖
  // 「未登录访客视角」
  const assertDormantForAnonymous = async () => {
    const anon = await browser.newContext({ locale: "zh-CN" });
    try {
      const anonPage = await anon.newPage();
      await anonPage.goto(`${FRONT_URL}/#/login`);
      await expect(anonPage.getByPlaceholder("账号")).toBeVisible({
        timeout: 15_000
      });
      await expect(anonPage.locator(".oauth-entry")).toHaveCount(0);
    } finally {
      await anon.close();
    }
  };

  if (!row) {
    // 无任何配置（等同未配置）：入口整块不渲染
    await assertDormantForAnonymous();
    return;
  }

  const patch = (value: unknown) =>
    page.request.patch(`${CONFIG_API}/${row.pk}`, { data: { value } });
  // SystemConfig post_save 信号即时失效 SysConfig 缓存，清空即时生效
  await patch([]);
  try {
    await assertDormantForAnonymous();
  } finally {
    // 无条件还原固定种子值：用例中途失败也不会把清空态留给后续用例
    // （afterEach 另有兜底，这里保证同一用例内后续步骤不受污染）
    await patch(OAUTH_SEED_PROVIDERS).catch(() => null);
  }
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
