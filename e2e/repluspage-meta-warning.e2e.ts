import { expect, test } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 元数据缺失的「失败可见」回归（G6 验收）。
 *
 * 现象背景：RePlusPage 的搜索列 / 表格列全部来自后端元数据（`search-columns` /
 * `search-fields`，首开经 `with_meta=1` 内联进列表响应）。后端漏配时页面表现为
 * 「空白但不报错」，是二开最高频的排查成本来源。
 *
 * 本用例以网络层模拟「后端不下发元数据」：列表响应剥掉 `search_columns` /
 * `search_fields` 内联键，独立元数据接口返回空载荷 —— 断言 DEV 环境下页面出现
 * 显式警示条（同时控制台有可操作报错），而不是静默空白。
 *
 * 仅在 DEV 生效的告警：E2E 前端是 vite dev server（`import.meta.env.DEV` 为真），
 * 因此该用例在 E2E 形态下有效；生产构建不渲染警示条（不影响视觉基线）。
 */
test("RePlusPage：元数据缺失时 DEV 出现显式警示", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", msg => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  // 只拦目标页面的**接口**：其余请求（登录 / 站点配置 / 菜单）保持原样。
  // 必须按 pathname 前缀判定——glob 写法 `**/api/system/online*` 会把 Vite 的模块
  // 请求 `/src/api/system/online.ts` 一并拦下，页面直接加载失败（实测踩过）。
  await page.route(
    url => url.pathname.startsWith("/api/system/online"),
    async route => {
      const requestUrl = route.request().url();
      if (/search-(columns|fields)/.test(requestUrl)) {
        // 独立元数据接口：返回空载荷（模拟「后端未配置元数据」）
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ code: 1000, data: [] })
        });
      }
      // 列表接口：保留真实数据，仅剥掉内联元数据键
      const response = await route.fetch();
      const body = await response.json().catch(() => null);
      if (body?.data) {
        delete body.data.search_columns;
        delete body.data.search_fields;
      }
      return route.fulfill({ response, json: body });
    }
  );

  await login(page);
  await openMenuPath(page, ["系统管理", "日志管理"], "/system/online/index");

  const alert = page.locator(".el-alert").filter({
    hasText: "未获取到列元数据"
  });
  // 判定点在「列表请求完成」后 1.5s（元数据可能走独立请求），断言用自动重试等待
  await expect(alert).toBeVisible({ timeout: 15_000 });
  await expect(alert).toContainText("XADMIN_APPS");
  expect(consoleErrors.some(text => text.includes("未获取到列元数据"))).toBe(
    true
  );
});

test("RePlusPage：元数据正常时不出警示（负对照）", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["系统管理", "日志管理"], "/system/online/index");
  await expect(page.locator(".el-table, .pure-table").first()).toBeVisible({
    timeout: 15_000
  });
  // 真实后端元数据齐全：警示条不得出现（防止「恒亮」的假实现）
  await expect(
    page.locator(".el-alert").filter({ hasText: "未获取到列元数据" })
  ).toHaveCount(0);
});
