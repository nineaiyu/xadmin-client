import { expect, test } from "@playwright/test";

import { BACKEND_URL, getAccessToken, login, openMenuPath } from "./helpers";

/**
 * 定时任务 E2E：手动执行 → 实时日志弹窗 → 执行历史 → crontab 页渲染。
 * 数据经后端 API 造（列表/表单增改链路由单测覆盖），UI 侧验证
 * 「立即执行 + WebSocket 实时日志 + 历史状态展示」核心链路。
 * 种子已注册真实任务 system.tasks.auto_clean_operation_job（E2E 环境 eager 执行）。
 */

const TASK_PATH = "system.tasks.auto_clean_operation_job";

/** 造一条 crontab 表达式，返回 pk */
async function createCrontab(
  page: import("@playwright/test").Page,
  token: string
) {
  const res = await page.request.post(
    `${BACKEND_URL}/api/system/tasks/crontab`,
    {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "e2e-test" },
      data: {
        minute: "7",
        hour: "4",
        day_of_week: "*",
        day_of_month: "*",
        month_of_year: "*"
      }
    }
  );
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return String(body?.data?.pk ?? "");
}

/** 造一条周期任务（crontab 关联），返回 pk */
async function createPeriodicTask(
  page: import("@playwright/test").Page,
  token: string,
  name: string,
  crontabPk: string
) {
  const res = await page.request.post(
    `${BACKEND_URL}/api/system/tasks/periodic`,
    {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "e2e-test" },
      data: {
        name,
        task: TASK_PATH,
        crontab: crontabPk,
        args: "[]",
        kwargs: "{}",
        enabled: true
      }
    }
  );
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return String(body?.data?.pk ?? "");
}

/** 经 API 立即执行任务，返回执行记录 pk（task_id） */
async function runTask(
  page: import("@playwright/test").Page,
  token: string,
  periodicPk: string
) {
  const res = await page.request.post(
    `${BACKEND_URL}/api/system/tasks/periodic/${periodicPk}/run`,
    { headers: { Authorization: `Bearer ${token}`, "User-Agent": "e2e-test" } }
  );
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return String(body?.data?.task_id ?? "");
}

test("定时任务：立即执行 → 实时日志弹窗 → 执行历史闭环", async ({ page }) => {
  const taskName = `e2e-periodic-${Date.now()}`;
  await login(page);
  const token = await getAccessToken(page);

  const crontabPk = await createCrontab(page, token);
  await createPeriodicTask(page, token, taskName, crontabPk);

  // 进入定时任务页，列表出现新任务
  await openMenuPath(
    page,
    ["系统管理", "任务管理"],
    "/system/celery/task/index"
  );
  const table = page.locator(".el-table");
  await expect(table).toBeVisible({ timeout: 15_000 });
  const row = page.locator(".el-table__row", { hasText: taskName }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });

  // 行内「立即执行」→ 气泡确认 → 自动打开实时日志弹窗
  await row.getByRole("button", { name: "立即执行" }).first().click();
  await page
    .locator(".el-popconfirm, .el-popper, .el-message-box")
    .getByRole("button", { name: "确定" })
    .first()
    .click();

  const dialog = page.locator(".el-dialog", { hasText: "日志" }).first();
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  const pre = dialog.locator(".task-log__pre");
  // WebSocket 增量推送：等待日志正文出现（eager 执行瞬时完成，服务端循环至少推一轮）
  await expect(pre).not.toBeEmpty({ timeout: 20_000 });
  await dialog.getByRole("button", { name: "关闭" }).first().click();
  await expect(dialog).toBeHidden();

  // 关闭弹窗后列表仍可见
  await expect(row).toBeVisible();
});

test("执行历史：手动执行产生记录，状态成功、触发人可见", async ({ page }) => {
  const taskName = `e2e-history-${Date.now()}`;
  await login(page);
  const token = await getAccessToken(page);

  const crontabPk = await createCrontab(page, token);
  const periodicPk = await createPeriodicTask(page, token, taskName, crontabPk);
  await runTask(page, token, periodicPk);

  // 执行历史页：新执行记录（任务路径为名），状态「成功」、触发人 xadmin
  await openMenuPath(page, ["任务管理"], "/system/celery/logs/index");
  const row = page.locator(".el-table__row", { hasText: TASK_PATH }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row).toContainText("成功");
  await expect(row).toContainText("xadmin");

  // 行内「日志」按钮 → 弹窗正文可见
  await row.getByRole("button", { name: "日志" }).first().click();
  const dialog = page.locator(".el-dialog", { hasText: "日志" }).first();
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(dialog.locator(".task-log__pre")).not.toBeEmpty({
    timeout: 20_000
  });
  await dialog.getByRole("button", { name: "关闭" }).first().click();
});

test("定时表达式页：crontab 列表渲染", async ({ page }) => {
  await login(page);
  const token = await getAccessToken(page);
  // 造一条特殊 minute（7），验证列表页展示
  const res = await page.request.post(
    `${BACKEND_URL}/api/system/tasks/crontab`,
    {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "e2e-test" },
      data: {
        minute: "7",
        hour: "4",
        day_of_week: "*",
        day_of_month: "*",
        month_of_year: "*"
      }
    }
  );
  expect(res.ok()).toBeTruthy();

  await openMenuPath(
    page,
    ["系统管理", "任务管理"],
    "/system/celery/crontab/index"
  );
  const table = page.locator(".el-table");
  await expect(table).toBeVisible({ timeout: 15_000 });
  // 任意 crontab 行存在即说明列表已渲染（minute 列首列含 "7" 的行）
  await expect(
    page.locator(".el-table__row", { hasText: "7" }).first()
  ).toBeVisible({ timeout: 15_000 });
});
