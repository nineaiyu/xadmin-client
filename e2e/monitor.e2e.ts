import { expect, test } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 系统监控面板：四类区块（主机资源 / 服务健康 / Redis+Celery / 慢请求）渲染。
 * E2E 环境（HEALTH_CHECK_SKIP_CELERY=True、memory broker）无真实 worker，
 * 只断言区块与文案渲染，不断言具体指标值。
 *
 * 监控增强（趋势/健康/告警/事件）依赖 scripts/e2e_seed.py 的 seed_monitor_scene：
 * daphne 不跑 gunicorn 心跳线程，没有这段数据历史趋势恒为空态。
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

test("系统监控：健康总览、趋势筛选与告警事件区块", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/monitor/index");

  // 健康总览横幅（api overview 的 health 字段；seed 造了一条未恢复磁盘告警）
  const banner = page.getByTestId("monitor-health-banner");
  await expect(banner).toBeVisible({ timeout: 15_000 });
  await expect(banner.getByText("健康总览")).toBeVisible();
  await expect(banner.getByText("未恢复告警").first()).toBeVisible();

  // 网络速率实时卡（psutil 快照，非心跳表）
  await expect(
    page.getByTestId("monitor-network-card").getByText("网络速率")
  ).toBeVisible();

  // 历史趋势：seed 24h 心跳 → 图表渲染；时间范围切换写回地址栏（分享链接可复现）
  await expect(
    page.getByTestId("monitor-history-chart").locator("svg").first()
  ).toBeVisible({ timeout: 15_000 });
  await page.locator(".el-radio-button", { hasText: "1 小时" }).first().click();
  await expect(page).toHaveURL(/range=1h/);
  await page
    .locator(".el-radio-button", { hasText: "24 小时" })
    .first()
    .click();
  await expect(page).toHaveURL(/range=24h/);

  // 资源告警：阈值回显 + 告警记录（seed 的磁盘告警为 firing）
  const alertPanel = page.getByTestId("monitor-alert-panel");
  await expect(alertPanel.getByText("磁盘使用率阈值").first()).toBeVisible();
  await expect(
    alertPanel.locator(".el-table").getByText("告警中").first()
  ).toBeVisible();

  // 阈值设置弹窗：四个阈值输入框渲染后取消（不写库，避免污染其他用例）
  await page.getByTestId("monitor-threshold-settings").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("告警阈值设置")).toBeVisible();
  await expect(dialog.locator(".el-input-number")).toHaveCount(4);
  await dialog.getByRole("button", { name: "取消" }).click();
  await expect(dialog).toBeHidden();

  // 导出下拉：四项导出入口（报表内容由后端单测覆盖，这里不做真实下载）。
  // el-dropdown 的 popper 会保留多份隐藏副本，必须限定可见菜单，否则 strict mode 冲突
  await page.getByTestId("monitor-export").hover();
  const exportMenu = page.locator(".el-dropdown-menu:visible");
  await expect(exportMenu.getByText("趋势数据（CSV）")).toBeVisible();
  await expect(exportMenu.getByText("告警记录（Excel）")).toBeVisible();
  await page.keyboard.press("Escape");

  // 事件记录：异常请求 / 任务失败标签页
  const eventPanel = page.getByTestId("monitor-event-panel");
  await expect(eventPanel.getByText("事件记录")).toBeVisible();
  await eventPanel.getByRole("tab", { name: "任务失败" }).click();
  await expect(eventPanel.getByText("任务名称")).toBeVisible();
  await eventPanel.getByRole("tab", { name: "异常请求" }).click();
  await expect(eventPanel.getByText("业务码")).toBeVisible();
});
