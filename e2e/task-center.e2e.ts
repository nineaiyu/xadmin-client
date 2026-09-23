import { expect, test } from "@playwright/test";

import {
  FRONT_URL,
  getAccessToken,
  HIGH_LOAD,
  login,
  openMenuPath
} from "./helpers";

/**
 * P-2 任务中心（双浏览器）：统一列表聚合三类记录 + 类型过滤 + 重跑 + 日志入口。
 *
 * 取消路径说明：E2E 环境 `CELERY_TASK_ALWAYS_EAGER=1`，导出/导入任务在请求内同步跑完
 * （库内不存在 PENDING/RUNNING 窗口）→ 界面不会出现「取消」按钮；取消语义
 * （PENDING 立即终态 / RUNNING 协作点收敛 / 已终态幂等 / 未知记录）由后端
 * `tests/unit/system/test_task_center.py` 与 `tests/integration/system/test_task_center_api.py`
 * 覆盖，这里只断言「可取消行判定」与重跑 / 日志链路。
 */
test("任务中心：统一列表 + 类型过滤 + 重跑 + 日志", async ({ page }) => {
  if (HIGH_LOAD) test.slow();
  await login(page);
  const token = await getAccessToken(page);

  // 造一条导出记录（用户管理异步导出；EAGER 下同步跑完 → SUCCESS）
  const created = await page.request.post(
    `${FRONT_URL}/api/system/user/export-async`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: { type: "xlsx" }
    }
  );
  expect(created.status()).toBe(200);
  const recordId = String((await created.json())?.data?.record_id ?? "");
  expect(recordId).not.toBe("");

  // 记录名（统一列表按名称展示，不含主键列）
  const listed = await page.request.get(
    `${FRONT_URL}/api/system/tasks/unified?type=export&size=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  expect(listed.status()).toBe(200);
  const rows = ((await listed.json())?.data?.results ?? []) as {
    pk: string;
    name: string;
    status: string;
    can_cancel: boolean;
  }[];
  const record = rows.find(item => item.pk === recordId);
  expect(record, "统一列表应包含刚创建的导出记录").toBeTruthy();
  expect(record!.status).toBe("SUCCESS");
  expect(record!.can_cancel).toBe(false); // 终态不可取消（取消入口仅在活跃行显示）

  await openMenuPath(page, ["系统管理"], "/system/task/index");
  const table = page.getByTestId("task-center-table");
  await expect(table).toBeVisible({ timeout: 15_000 });

  const targetRow = table
    .locator("tbody tr", { hasText: record!.name })
    .first();
  await expect(targetRow).toBeVisible({ timeout: 10_000 });
  await expect(targetRow).toContainText("导出");
  await expect(targetRow).toContainText("成功");

  // 类型过滤：切到「导入」后该导出记录不再出现
  await page.getByTestId("task-center-type").click();
  await page
    .locator(".el-select-dropdown:visible .el-select-dropdown__item")
    .filter({ hasText: "导入" })
    .first()
    .click();
  await page.getByRole("button", { name: "搜索", exact: true }).first().click();
  await expect(
    table.locator("tbody tr", { hasText: record!.name })
  ).toHaveCount(0, {
    timeout: 10_000
  });

  // 回到「导出」→ 重跑（白名单：导出 / 导入 / 报表）
  await page.getByTestId("task-center-type").click();
  await page
    .locator(".el-select-dropdown:visible .el-select-dropdown__item")
    .filter({ hasText: "导出" })
    .first()
    .click();
  await page.getByRole("button", { name: "搜索", exact: true }).first().click();
  await expect(targetRow).toBeVisible({ timeout: 10_000 });
  await targetRow.getByRole("button", { name: "重跑" }).click();
  const rerunRow = table
    .locator("tbody tr", { hasText: `${record!.name}-rerun` })
    .first();
  await expect(rerunRow).toBeVisible({ timeout: 15_000 });

  // 日志入口：打开执行日志弹窗（WebSocket 增量 tail）
  // 重跑成功通知会悬浮在右下角拦截点击（EP notification）：等它自动关闭再点
  // 重跑成功通知带操作按钮不自动消失（EP notification）：显式关掉再点
  await page
    .locator(".el-notification__closeBtn")
    .first()
    .click({ timeout: 3_000 })
    .catch(() => null);
  await page
    .locator(".el-notification")
    .first()
    .waitFor({ state: "hidden", timeout: 5_000 })
    .catch(() => null);
  await rerunRow.getByRole("button", { name: "日志" }).click();
  await expect(page.locator(".el-dialog", { hasText: "执行日志" })).toBeVisible(
    {
      timeout: 15_000
    }
  );
});
