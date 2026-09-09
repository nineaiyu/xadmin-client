import { expect, test } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 系统监控面板：四类区块（主机资源 / 服务健康 / Redis+Celery / 慢请求）渲染。
 * E2E 环境（HEALTH_CHECK_SKIP_CELERY=True、memory broker）无真实 worker，
 * 只断言区块与文案渲染，不断言具体指标值。
 */
test("系统监控：面板各区块渲染", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/monitor/index");

  // 主机资源概览卡
  await expect(page.getByText("CPU 使用率").first()).toBeVisible({
    timeout: 15_000
  });
  await expect(page.getByText("磁盘使用率").first()).toBeVisible();

  // 服务健康卡（DB / Redis / Celery 三项；状态标签与文案同节点，用子串匹配）
  await expect(page.getByText("服务健康").first()).toBeVisible();
  await expect(
    page.locator("span", { hasText: "数据库" }).first()
  ).toBeVisible();
  await expect(
    page.locator("span", { hasText: "Celery" }).first()
  ).toBeVisible();

  // Redis 卡
  await expect(page.getByText("缓存命中率").first()).toBeVisible();

  // Celery 卡：E2E 环境跳过探测或无 worker
  await expect(
    page
      .getByText("当前环境未启用 Celery 探测")
      .or(page.getByText("暂无在线 worker"))
      .first()
  ).toBeVisible({ timeout: 15_000 });

  // 慢请求区
  await expect(page.getByText("慢请求 Top 20").first()).toBeVisible();
});
