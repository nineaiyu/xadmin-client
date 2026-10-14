import {
  expect,
  request as playwrightRequest,
  test,
  type Page
} from "@playwright/test";

import {
  login,
  openSettingPanel,
  switchSettingTab,
  PLAIN_USER
} from "./helpers";

/**
 * 站点级外观配置（站点标题 / Logo 品牌位 / 登录页布局）：
 * 写入系统级配置 → 全局生效（匿名读取与登录页一致），仅管理员可改；
 * 其余偏好键保持个人级语义。回归背景：这些键此前写个人配置，改完只有
 * 自己可见，登录页/其他账号恒为旧值（「配置不生效」的主要来源）。
 */

const SITE_CONFIG_URL = "/api/system/configs/WEB_SITE_CONFIG";
/** 后端直连地址（匿名请求用；与 playwright.config.ts 的 E2E_API_PORT 对齐） */
const API_BASE = `http://127.0.0.1:${process.env.E2E_API_PORT ?? "8896"}`;

/** 面板行（`.setting li` 契约）：`:visible` 过滤非活动页签里的同名行 */
function row(page: Page, label: string | RegExp) {
  return page
    .locator(".right-panel .setting li:visible")
    .filter({ hasText: label })
    .first();
}

/** 站点标题输入（通用页签） */
function titleInput(page: Page) {
  return row(page, "站点标题").locator("input").first();
}

/** 面板页脚按钮（按文案定位，与语言解耦） */
function footerButton(page: Page, label: RegExp) {
  return page
    .locator(".right-panel .lay-panel__footer .el-button")
    .filter({ hasText: label })
    .first();
}

/** 页脚「更多」下拉触发按钮（类名定位，与语言解耦） */
function footerMoreTrigger(page: Page) {
  return page.locator(".right-panel .lay-panel__footer-more");
}

/**
 * 打开页脚「更多」菜单并返回其中的菜单项定位器。
 * 站点默认 / 复制偏好 / 清空缓存收在该菜单里；下拉 popper 会保留隐藏副本，
 * 断言必须限定在可见菜单上（`.el-dropdown-menu:visible`）。
 */
async function openFooterMore(page: Page, label: RegExp) {
  await footerMoreTrigger(page).click();
  const item = page
    .locator(".el-dropdown-menu:visible .el-dropdown-menu__item")
    .filter({ hasText: label })
    .first();
  await expect(item).toBeVisible({ timeout: 10_000 });
  return item;
}

/** 本地存储里的站点级外观现值（与页面 hydrate 同一来源） */
function storedAppearance(page: Page, key: string) {
  return page.evaluate(k => {
    const raw = localStorage.getItem("responsive-configure");
    return raw ? (JSON.parse(raw) as Record<string, unknown>)[k] : undefined;
  }, key);
}

/** 等待站点配置整包 PATCH 落库并返回响应体 */
async function waitForSiteConfigPatch(page: Page, action: () => Promise<void>) {
  const saved = page.waitForResponse(
    resp =>
      resp.request().method() === "PATCH" &&
      resp.url().includes(SITE_CONFIG_URL)
  );
  await action();
  const response = await saved;
  expect(response.status()).toBe(200);
  return response.json();
}

test.describe("站点级外观配置", () => {
  test("管理员改动全局生效：匿名读取与登录页同步（站点标题）", async ({
    page
  }) => {
    const marker = `E2E站点标题${Date.now()}`;

    await login(page);
    await openSettingPanel(page);
    await switchSettingTab(page, "通用");

    const input = titleInput(page);
    const original = await input.inputValue();

    const saved = page.waitForResponse(
      resp =>
        resp.request().method() === "PATCH" &&
        resp.url().includes(SITE_CONFIG_URL)
    );
    await input.fill(marker);
    await input.press("Enter");
    const response = await saved;
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.code).toBe(1000);
    // 保存响应即系统权威值（读取侧已把站点级键统一为系统配置）
    expect(body.config.Title).toBe(marker);

    // 匿名会话读取：站点级键全局生效的硬证据（未被个人配置隔离）
    const anon = await playwrightRequest.newContext({ baseURL: API_BASE });
    try {
      const anonResp = await anon.get("/api/system/configs/WEB_SITE_CONFIG");
      const anonBody = await anonResp.json();
      expect(anonBody.config.Title).toBe(marker);
    } finally {
      await anon.dispose();
    }

    // 复位：改回原值并等落库（避免污染其它用例与视觉基线）
    const reset = page.waitForResponse(
      resp =>
        resp.request().method() === "PATCH" &&
        resp.url().includes(SITE_CONFIG_URL)
    );
    await input.fill(original);
    await input.press("Enter");
    const resetBody = await (await reset).json();
    expect(resetBody.code).toBe(1000);
    expect(resetBody.config.Title).toBe(original);
  });

  test("管理员：恢复站点默认把站点级外观写回平台默认值", async ({ page }) => {
    /** 平台出厂默认值（部署方替换 public/platform-config.json 即改此值） */
    const platformConfig = (await (
      await page.request.get("/platform-config.json")
    ).json()) as Record<string, unknown>;
    const defaultTitle = platformConfig.Title as string;

    await login(page);
    await openSettingPanel(page);
    await switchSettingTab(page, "通用");
    const input = titleInput(page);
    const original = await input.inputValue();
    const marker = `E2E站点标题${Date.now()}`;

    // 先把站点标题改成标记值（写系统配置、全局生效）
    const changed = await waitForSiteConfigPatch(page, async () => {
      await input.fill(marker);
      await input.press("Enter");
    });
    expect(changed.config.Title).toBe(marker);

    // 恢复站点默认：入口仅管理员可见（收在页脚「更多」菜单）；二次确认后写回出厂值
    const siteDefaults = await openFooterMore(
      page,
      /恢复站点默认|Restore site defaults/
    );
    const restored = await waitForSiteConfigPatch(page, async () => {
      await siteDefaults.click();
      await page
        .locator(".el-message-box:visible")
        .getByRole("button", { name: /^(确定|Sure)$/ })
        .click();
    });
    expect(restored.config.Title).toBe(defaultTitle);
    expect(restored.config.AuthPageLayout).toBe(platformConfig.AuthPageLayout);
    // 本地即时生效 + 控件（重挂载后）同步显示出厂值
    expect(await storedAppearance(page, "title")).toBe(defaultTitle);
    await expect(input).toHaveValue(defaultTitle);

    // 复位：仅当测试前的值不等于出厂值才需要改回（避免污染其它用例与视觉基线）；
    // 相等时改回是空写（存储无变化 → 不触发 PATCH），不能等落库
    if (original !== defaultTitle) {
      const back = await waitForSiteConfigPatch(page, async () => {
        await input.fill(original);
        await input.press("Enter");
      });
      expect(back.config.Title).toBe(original);
    } else {
      expect(await storedAppearance(page, "title")).toBe(original);
    }
  });

  test("非管理员：站点级字段只读（标题 / 登录页布局 / Logo）", async ({
    page
  }) => {
    await login(page, PLAIN_USER);
    await openSettingPanel(page);
    await switchSettingTab(page, "通用");

    await expect(titleInput(page)).toBeDisabled();
    await expect(
      row(page, "登录页布局").locator(".pref-choice__item").first()
    ).toBeDisabled();
    // 「恢复站点默认」是站点级动作：非管理员在页脚「更多」里也拿不到该入口
    await footerMoreTrigger(page).click();
    const moreItems = page.locator(
      ".el-dropdown-menu:visible .el-dropdown-menu__item"
    );
    // 菜单确实打开（清空缓存项在），但站点级项不存在
    await expect(
      moreItems.filter({ hasText: /清空缓存|Clear the cache/ })
    ).toHaveCount(1);
    await expect(
      moreItems.filter({ hasText: /恢复站点默认|Restore site defaults/ })
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    // 「恢复默认」只作用个人偏好：非管理员同样可用
    await expect(footerButton(page, /恢复默认|Restore defaults/)).toBeEnabled();

    await switchSettingTab(page, "布局");
    await expect(
      row(page, "Logo 形态").locator(".pref-choice__item").first()
    ).toBeDisabled();
    await expect(
      row(page, "Logo 图片").locator("input").first()
    ).toBeDisabled();
  });
});
