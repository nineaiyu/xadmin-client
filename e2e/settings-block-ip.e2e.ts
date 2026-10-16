import { expect, test } from "@playwright/test";

import { login } from "./helpers";

/**
 * 系统设置 → 安全设置：登录拦截 IP 列表链路。
 *
 * 历史缺陷：该接口经 `cache.iter_keys` 遍历拦截键，E2E 档进程内缓存后端
 * （服务端 `tests/cache_backend.py::FakeRedisCache`）缺该方法时 500、页面
 * 静默降级为空表——真 Redis 档与单测都不覆盖此缺口。本用例在 E2E 档直接
 * 请求该接口（带真实认证头），守护「缓存后端能力 ↔ 接口链路」一致性。
 */
test("安全设置：登录拦截 IP 列表接口可用（E2E 档缓存后端能力）", async ({
  page
}) => {
  await login(page);

  const result = await page.evaluate(async () => {
    const cookie = document.cookie
      .split("; ")
      .find(item => item.startsWith("X-Token="));
    const token = cookie
      ? decodeURIComponent(cookie.split("=").slice(1).join("="))
      : "";
    // 后端 settings 域路由为 SimpleRouter(trailing_slash=False)：路径不带尾斜杠
    const response = await fetch("/api/settings/ip/block?page=1&size=10", {
      headers: token ? { Authorization: "Bearer " + token } : {}
    });
    const body = await response.text();
    return { status: response.status, head: body.slice(0, 160) };
  });
  expect(result.status, result.head).toBe(200);

  // UI 面回归：安全设置页正常渲染（接口 500 时页面仍会打开，故此处只守护
  // 页面可达；接口正确性以上方断言为准）
  await page.goto("/#/settings/security/index");
  await expect(page.locator(".setting-page").first()).toBeVisible({
    timeout: 15_000
  });
});
