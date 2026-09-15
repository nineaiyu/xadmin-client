import { expect, test, type Page } from "@playwright/test";

import { login } from "./helpers";

/**
 * i18n 按需加载守护（2026-09-15）：en 语言包不随首屏闭包
 * （src/plugins/i18n.ts 的 ensureLocale 动态加载 en.yaml + element-plus en locale），
 * 覆盖两条真实路径：
 *   1) 运行中切换语言：zh → en → zh 往返，文案即时生效；
 *   2) 英文落库后刷新：首屏即英文（命中 main.ts mount 前的 ensureLocale 与 watch 兜底）。
 *
 * 注意：语言偏好由站点配置（PATCH /api/system/configs/WEB_SITE_CONFIG，自动保存带防抖）
 * 持久化，且该配置为**跨用例共享数据** —— 每个用例结束必须切回中文并等落库，
 * 否则后续 spec 会以英文启动导致中文断言连锁失败。
 */
const SITE_CONFIG_URL = "/api/system/configs/WEB_SITE_CONFIG";

/** 等语言偏好落库（防抖后的自动保存请求） */
function waitSiteConfigSaved(page: Page) {
  return page.waitForResponse(
    resp =>
      resp.url().includes(SITE_CONFIG_URL) &&
      resp.request().method() === "PATCH",
    { timeout: 20_000 }
  );
}

/** 恢复中文界面并等落库（用例收尾统一调用） */
async function restoreChinese(page: Page) {
  const restored = waitSiteConfigSaved(page);
  await page.locator("#header-translation").click();
  await page.locator(".translation").getByText("简体中文").click();
  await expect(page.getByText("系统管理").first()).toBeVisible({
    timeout: 15_000
  });
  await restored;
}

test.describe("i18n 语言包按需加载", () => {
  test("顶栏切换英文并切回中文（切换路径）", async ({ page }) => {
    await login(page);
    await expect(page.getByText("系统管理").first()).toBeVisible();

    await page.locator("#header-translation").click();
    await page.locator(".translation").getByText("English").click();
    await expect(page.getByText("System Manage").first()).toBeVisible({
      timeout: 15_000
    });

    await restoreChinese(page);
  });

  test("英文落库后刷新：首屏即英文（初始语言按需加载）", async ({ page }) => {
    await login(page);
    const saved = waitSiteConfigSaved(page);
    await page.locator("#header-translation").click();
    await page.locator(".translation").getByText("English").click();
    await expect(page.getByText("System Manage").first()).toBeVisible({
      timeout: 15_000
    });
    await saved;

    await page.reload();
    // 刷新后初始 locale 从站点配置恢复为 en，语言包由 mount 前的 ensureLocale 加载 ——
    // 不应出现 key 泄漏或中文残留
    await expect(page.getByText("System Manage").first()).toBeVisible({
      timeout: 20_000
    });

    await restoreChinese(page);
  });
});
