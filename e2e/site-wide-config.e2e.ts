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

    await switchSettingTab(page, "布局");
    await expect(
      row(page, "Logo 形态").locator(".pref-choice__item").first()
    ).toBeDisabled();
    await expect(
      row(page, "Logo 图片").locator("input").first()
    ).toBeDisabled();
  });
});
