import {
  expect,
  test,
  type APIRequestContext,
  type Page
} from "@playwright/test";

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
 *
 * 2026-09-17 补：仅靠 UI 下拉还原不够健壮 —— 下拉/断言一旦在 webkit 失败，英文就被留给
 * 后续 spec（表现为「后一个浏览器阶段成批中文定位器失配」，曾误判为 webkit flaky）。
 * 因此新增 afterEach **接口兜底还原**：无论用例成功失败，都把 Locale 写回 zh。
 * 两个细节（实测踩过）：兜底前先关页面（销毁前端防抖保存的定时器，否则它可能在本兜底
 * 写入之后才落库把 en 写回）；不读旧值短路跳过（读取与写入之间的窗口会漏掉随后落库的 en）。
 */
const SITE_CONFIG_URL = "/api/system/configs/WEB_SITE_CONFIG";
const CONFIG_API = "/api/system/config/system";

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

/**
 * 接口兜底还原中文：不依赖 UI 下拉，因此用例中途失败（断言/渲染问题）也能把共享状态还原，
 * 避免「英文落库 → 后续 spec 中文定位器连锁失败」。无条件写回（幂等），不读旧值短路。
 */
async function restoreLocaleViaApi(request: APIRequestContext) {
  try {
    const listResp = await request.get(`${CONFIG_API}?key=WEB_SITE_CONFIG`);
    const rows = (await listResp.json())?.data?.results ?? [];
    const row = Array.isArray(rows)
      ? rows.find(item => item.key === "WEB_SITE_CONFIG")
      : undefined;
    if (!row) return;
    const value =
      typeof row.value === "string" ? JSON.parse(row.value) : row.value;
    await request.patch(`${CONFIG_API}/${row.pk}`, {
      data: { value: { ...(value ?? {}), Locale: "zh" } }
    });
  } catch {
    // 兜底失败不掩盖用例本身的失败原因
  }
}

test.afterEach(async ({ page, context }) => {
  // 先关页面：销毁前端防抖自动保存的定时器，避免它在本兜底写入之后又把 en 落库
  try {
    await page.close();
  } catch {
    // 页面可能已被框架关闭：不影响接口兜底还原
  }
  await restoreLocaleViaApi(context.request);
});

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
