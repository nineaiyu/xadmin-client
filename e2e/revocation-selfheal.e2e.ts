import { expect, test } from "@playwright/test";

import { login } from "./helpers";

/**
 * 收权自愈（会话内 403 信号）：运行中收到任意 403 → 清动态路由/权限快照 →
 * 下次进入重新拉取收敛。403 是「会话内被收权」的唯一运行时信号
 * （forbiddenSnapshotStrategy，errorStrategies.ts），丢掉它，被收权限会
 * 沿用旧快照直到下次刷新。
 *
 * 可行性口径（报告 14 缺口 G-03）：真实收权需运行中改库/换 token，E2E 难以
 * 编排，此处用请求拦截一次性模拟 403 + 预置快照键模拟「快照模式开启态」
 * （出厂 CachingAsyncRoutes=false，预置键等价于开启部署的本地状态，无需改
 * 平台配置）。断言分两段：
 * ① 收到 403 后，本地快照三键被清空（自愈信号落地）；
 * ② 清空后整页刷新能重新拉取路由并恢复应用壳（自愈闭环、不白屏卡死）。
 */

/** 快照三键：src/utils/routeSnapshot.ts 的 ROUTE_SNAPSHOT_KEYS 同名镜像 */
const SNAPSHOT_KEYS = ["async-routes", "async-auths", "async-routes-version"];

test("会话内 403：清空路由/权限快照，重进后重新拉取收敛", async ({ page }) => {
  await login(page);

  // 预置快照态（键名与写入方一致，内容仅需可判定存在）
  await page.evaluate(keys => {
    for (const key of keys) localStorage.setItem(key, "e2e-stale-snapshot");
  }, SNAPSHOT_KEYS);

  // 模拟会话内收权：用户列表请求一次性 403（经应用 axios 链路触发策略；
  // 无论首个命中请求是不是列表，任意在应用内收到的 403 都应清快照）
  let deniedOnce = false;
  await page.route("**/api/identity/user?**", async route => {
    if (deniedOnce) {
      await route.fallback();
      return;
    }
    deniedOnce = true;
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ code: 403, detail: "权限已被收回" })
    });
  });

  // hash 变化属同文档导航：预置的快照键不会被启动链路读取或清理
  await page.goto("/#/system/user/index");

  // ① 403 信号落地：快照三键全部被清空（poll 轮询，不盲等）
  for (const key of SNAPSHOT_KEYS) {
    await expect
      .poll(
        async () =>
          page.evaluate(
            (k: string) => localStorage.getItem(k) as string | null,
            key
          ),
        { timeout: 15_000 }
      )
      .toBeNull();
  }

  // ② 自愈闭环：解除拦截后整页刷新，路由重新拉取且应用壳恢复（不白屏卡死）
  await page.unroute("**/api/identity/user?**");
  const routesFetched = page
    .waitForResponse(
      response =>
        response.url().includes("/api/system/routes") &&
        response.request().method() === "GET",
      { timeout: 20_000 }
    )
    .catch(() => null);
  await page.reload();
  const routes = await routesFetched;
  expect(routes?.ok()).toBeTruthy();
  await expect(page.locator("#header-translation")).toBeVisible({
    timeout: 15_000
  });
});
