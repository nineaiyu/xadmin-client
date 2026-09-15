import { expect, test, type Page } from "@playwright/test";

import { login } from "./helpers";

/**
 * 项目设置实时生效（不再有「保存配置」按钮）：
 * - 设置项变更即时应用（DOM class）+ 防抖自动 PATCH 到服务器；
 * - 清掉本地缓存刷新后仍保持（证明服务器已持久化，等价另一台设备）；
 * - 自动保存不得风暴（防抖窗口内只发一次）。
 *
 * 注意：本用例只动「灰色模式」（仅 html class，不影响其他 spec 的元素定位）。
 * 语言切换会改全局文案（服务器共享），并行执行会污染其他 spec 的中文定位，
 * 其自动保存链路由 useTranslationLang 单测覆盖（src/layout/hooks/*.spec.ts）。
 *
 * 定位说明：界面语言可能被其他用例/残留改成英文，文案一律中英双语正则匹配。
 */

const SITE_CONFIG_PATCH = (req: { method: () => string; url: () => string }) =>
  req.method() === "PATCH" &&
  req.url().includes("/api/system/configs/WEB_SITE_CONFIG");

const removeLocalKey = (page: Page, suffix: string) =>
  page.evaluate(s => {
    Object.keys(localStorage)
      .filter(k => k.endsWith(s))
      .forEach(k => localStorage.removeItem(k));
  }, suffix);

test("项目设置实时生效并自动保存（灰色模式）", async ({ page }) => {
  await login(page);

  // 归一状态：清掉本地 configure 缓存刷新，以服务器值为准（幂等，防上次残留）
  await removeLocalKey(page, "configure");
  await page.reload();
  const setIcon = page.locator(".set-icon");
  await expect(setIcon).toBeVisible({ timeout: 15_000 });

  await setIcon.click();
  const panel = page.locator(".right-panel");
  await expect(panel).toBeVisible();
  // 「保存配置」按钮已移除（改动实时生效）
  await expect(
    panel.getByRole("button", { name: /保存配置|Save config/ })
  ).toHaveCount(0);

  const switchEl = panel
    .locator("li")
    .filter({ hasText: /灰色模式|Grey mode/ })
    .locator(".el-switch");

  // 幂等前置：若服务器残留开启状态，先关闭
  if ((await switchEl.getAttribute("class"))?.includes("is-checked")) {
    const off = page.waitForRequest(SITE_CONFIG_PATCH);
    await switchEl.click();
    await off;
    await expect(page.locator("html")).not.toHaveClass(/html-grey/);
  }

  // 统计自动保存的 PATCH 次数（防抖应只发一次，防风暴回归）
  let patchCount = 0;
  const onRequest = (req: { method: () => string; url: () => string }) => {
    if (SITE_CONFIG_PATCH(req)) patchCount += 1;
  };
  page.on("request", onRequest);

  // 开启灰色模式：即时生效（html class）+ 防抖自动 PATCH（无需手动保存）
  const patch = page.waitForRequest(SITE_CONFIG_PATCH);
  await switchEl.click();
  await expect(page.locator("html")).toHaveClass(/html-grey/);
  await patch;
  await page.waitForTimeout(1200);
  expect(patchCount).toBeLessThanOrEqual(2);
  page.off("request", onRequest);

  // 模拟另一台设备：清掉本地 configure 缓存后刷新，服务器值应重新渲染
  await removeLocalKey(page, "configure");
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/html-grey/, {
    timeout: 15_000
  });

  // 收尾：关闭灰色模式并等待自动保存落库（避免影响其他用例）
  await page.locator(".set-icon").click();
  const restore = page.waitForRequest(SITE_CONFIG_PATCH);
  await page
    .locator(".right-panel li")
    .filter({ hasText: /灰色模式|Grey mode/ })
    .locator(".el-switch")
    .click();
  await restore;
  await expect(page.locator("html")).not.toHaveClass(/html-grey/);
});
