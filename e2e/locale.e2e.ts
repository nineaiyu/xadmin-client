import {
  expect,
  test,
  type APIRequestContext,
  type Page,
  type Response
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
 *
 * 2026-09-17 再补（并行分片真实失败归因）：等「任意 PATCH」会误判落库 —— 匹配到的可能是
 * 上一个用例的防抖保存，用例随后 reload 时本次 en 的 PATCH 还没发出（或被 page.close
 * 打断）→ 英文从未落库，reload 后仍是中文；两个防抖 PATCH 乱序还会让 en 后落库残留。
 * 因此所有「等落库」统一为**按目标语言精确匹配且要求 HTTP 成功**；
 * helpers.login 的语言自愈作为第三层兜底。
 */
const SITE_CONFIG_URL = "/api/system/configs/WEB_SITE_CONFIG";
const CONFIG_API = "/api/system/config/system";

/** 等「目标语言」的站点配置保存成功（前端防抖 PATCH，body 顶层 Locale 字段） */
function waitLocaleSaved(page: Page, locale: "en" | "zh") {
  return page.waitForResponse(
    resp => {
      if (
        !resp.url().includes(SITE_CONFIG_URL) ||
        resp.request().method() !== "PATCH"
      ) {
        return false;
      }
      const body = resp.request().postData() ?? "";
      try {
        return resp.ok() && JSON.parse(body)?.Locale === locale;
      } catch {
        return false;
      }
    },
    { timeout: 20_000 }
  );
}

/** 断言落库请求成功（把「保存失败（401/500）」与「保存没发生」区分开，提高可诊断性） */
function expectSaved(resp: Response, locale: string) {
  expect(
    resp.ok(),
    `站点配置保存失败（HTTP ${resp.status()}）：语言 ${locale} 未能落库`
  ).toBeTruthy();
}

/** 恢复中文界面并等落库（用例收尾统一调用） */
async function restoreChinese(page: Page) {
  const restored = waitLocaleSaved(page, "zh");
  await page.locator("#header-translation").click();
  await page.locator(".translation").getByText("简体中文").click();
  await expect(page.getByText("系统管理").first()).toBeVisible({
    timeout: 15_000
  });
  expectSaved(await restored, "zh");
}

/**
 * 接口兜底还原中文：不依赖 UI 下拉，因此用例中途失败（断言/渲染问题）也能把共享状态还原，
 * 避免「英文落库 → 后续 spec 中文定位器连锁失败」。无条件写回（幂等），不读旧值短路。
 * 失败重试一次：兜底通道本身也可能受 token/网络瞬态影响（并行下实测出现过 401）。
 */
async function restoreLocaleViaApi(request: APIRequestContext) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const listResp = await request.get(`${CONFIG_API}?key=WEB_SITE_CONFIG`);
      const rows = (await listResp.json())?.data?.results ?? [];
      const row = Array.isArray(rows)
        ? rows.find(item => item.key === "WEB_SITE_CONFIG")
        : undefined;
      if (!row) return;
      const value =
        typeof row.value === "string" ? JSON.parse(row.value) : row.value;
      const resp = await request.patch(`${CONFIG_API}/${row.pk}`, {
        data: { value: { ...(value ?? {}), Locale: "zh" } }
      });
      if (resp.ok()) return;
    } catch {
      // 走重试
    }
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

    const savedEn = waitLocaleSaved(page, "en");
    await page.locator("#header-translation").click();
    await page.locator(".translation").getByText("English").click();
    await expect(page.getByText("System Manage").first()).toBeVisible({
      timeout: 15_000
    });
    // 等英文真正落库再切回：两个防抖 PATCH 乱序会让 en 后落库残留
    expectSaved(await savedEn, "en");

    await restoreChinese(page);
  });

  test("英文落库后刷新：首屏即英文（初始语言按需加载）", async ({ page }) => {
    await login(page);
    const saved = waitLocaleSaved(page, "en");
    await page.locator("#header-translation").click();
    await page.locator(".translation").getByText("English").click();
    await expect(page.getByText("System Manage").first()).toBeVisible({
      timeout: 15_000
    });
    // 必须确认 en 已落库再刷新，否则 reload 后仍按中文站点配置渲染（历史假失败）
    expectSaved(await saved, "en");

    await page.reload();
    // 刷新后初始 locale 从站点配置恢复为 en，语言包由 mount 前的 ensureLocale 加载 ——
    // 不应出现 key 泄漏或中文残留
    await expect(page.getByText("System Manage").first()).toBeVisible({
      timeout: 20_000
    });

    await restoreChinese(page);
  });
});
