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

/**
 * 在定时任务页按名称前缀检索，把目标行收敛到第一页。
 * 列表按任务名称倒序排列且每页 15 行，历史运行（双浏览器两波 + 失败重试）堆积的
 * e2e-* 任务会让新任务排在全量列表末尾，可能落在第 2 页，直接按名字找行会超时。
 */
async function searchTaskByName(
  page: import("@playwright/test").Page,
  prefix: string
) {
  const nameInput = page.getByPlaceholder("请输入任务名称");
  await expect(nameInput).toBeVisible({ timeout: 15_000 });
  await nameInput.fill(prefix);
  await page.getByRole("button", { name: "搜索" }).click();
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
  // 列表按名称倒序且堆积后可能多页：先按唯一名称检索，收敛目标行到第一页
  await searchTaskByName(page, taskName);
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
  await openMenuPath(
    page,
    ["系统管理", "任务管理"],
    "/system/celery/logs/index"
  );
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

test("定时任务：批量执行 → 执行历史产生多条成功记录", async ({ page }) => {
  const suffix = Date.now();
  const names = [`e2e-batch-${suffix}-a`, `e2e-batch-${suffix}-b`];
  await login(page);
  const token = await getAccessToken(page);

  const crontabPk = await createCrontab(page, token);
  for (const name of names) {
    await createPeriodicTask(page, token, name, crontabPk);
  }

  // 定时任务页：逐行勾选 → 表头「批量执行」→ 确认
  await openMenuPath(
    page,
    ["系统管理", "任务管理"],
    "/system/celery/task/index"
  );
  const table = page.locator(".el-table");
  await expect(table).toBeVisible({ timeout: 15_000 });
  // 全量列表按名称倒序且可能多页：先按唯一前缀检索，把两条任务收敛到第一页
  await searchTaskByName(page, `e2e-batch-${suffix}`);
  for (const name of names) {
    // 主表体行（避开 el-table fixed 列的 DOM 副本），点击 label 触发勾选
    const bodyRow = page
      .locator(".el-table__body-wrapper .el-table__row", { hasText: name })
      .first();
    await expect(bodyRow).toBeVisible({ timeout: 15_000 });
    const checkboxLabel = bodyRow.locator(".el-checkbox").first();
    await checkboxLabel.click();
    await expect(checkboxLabel).toHaveClass(/is-checked/);
  }
  await page.getByRole("button", { name: "批量执行" }).click();
  await page
    .locator(".el-popconfirm, .el-popper, .el-message-box")
    .getByRole("button", { name: "确定" })
    .first()
    .click();
  await expect(page.locator(".el-message--success")).toBeVisible();

  // 执行历史页：两条新记录均「成功」（所属定时任务列显示任务名）
  await openMenuPath(
    page,
    ["系统管理", "任务管理"],
    "/system/celery/logs/index"
  );
  for (const name of names) {
    const row = page.locator(".el-table__row", { hasText: name }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row).toContainText("成功");
  }
});

test("执行历史：行删除与批量删除后记录消失", async ({ page }) => {
  const suffix = Date.now();
  const names = [
    `e2e-logdel-${suffix}-1`,
    `e2e-logdel-${suffix}-2`,
    `e2e-logdel-${suffix}-3`
  ];
  await login(page);
  const token = await getAccessToken(page);

  const crontabPk = await createCrontab(page, token);
  for (const name of names) {
    const periodicPk = await createPeriodicTask(page, token, name, crontabPk);
    await runTask(page, token, periodicPk);
  }

  await openMenuPath(
    page,
    ["系统管理", "任务管理"],
    "/system/celery/logs/index"
  );
  // 限定可见表格：keep-alive 缓存了定时任务页 DOM，避免跨页 hasText 串扰
  const visibleRow = (name: string) =>
    page.locator(".el-table:visible .el-table__row", { hasText: name }).first();

  // 行删除：第 1 条 → popconfirm 确认 → 行消失
  const firstRow = visibleRow(names[0]);
  await expect(firstRow).toBeVisible({ timeout: 15_000 });
  await firstRow.getByRole("button", { name: "删除" }).first().click();
  await page
    .locator(".el-popconfirm")
    .getByRole("button", { name: "确定" })
    .first()
    .click();
  await expect(page.locator(".el-message--success")).toBeVisible();
  await expect(visibleRow(names[0])).toBeHidden();

  // 批量删除：勾选剩余两条 → 表头「批量删除」→ popconfirm 确认 → 行消失
  for (const name of names.slice(1)) {
    const row = visibleRow(name);
    const checkboxLabel = row.locator(".el-checkbox").first();
    await checkboxLabel.click();
    await expect(checkboxLabel).toHaveClass(/is-checked/);
  }
  await page.getByRole("button", { name: "批量删除" }).click();
  await page
    .locator(".el-popconfirm")
    .getByRole("button", { name: "确定" })
    .first()
    .click();
  await expect(page.locator(".el-message--success")).toBeVisible();
  for (const name of names.slice(1)) {
    await expect(visibleRow(name)).toBeHidden();
  }
});

test("定时任务：克隆 → 生成停用副本", async ({ page }) => {
  const taskName = `e2e-clone-${Date.now()}`;
  await login(page);
  const token = await getAccessToken(page);

  const crontabPk = await createCrontab(page, token);
  await createPeriodicTask(page, token, taskName, crontabPk);

  await openMenuPath(
    page,
    ["系统管理", "任务管理"],
    "/system/celery/task/index"
  );
  // 列表按名称倒序且堆积后可能多页：先按唯一名称检索，收敛目标行到第一页。
  // 克隆生成的 -copy 副本前缀相同（icontains 命中），刷新后仍在同一页。
  await searchTaskByName(page, taskName);
  const row = page
    .locator(".el-table__body-wrapper .el-table__row", {
      hasText: taskName
    })
    .first();
  await expect(row).toBeVisible({ timeout: 15_000 });

  // 行内「克隆」→ popconfirm 确认 → 列表出现停用的 -copy 副本
  await row.getByRole("button", { name: "克隆" }).first().click();
  await page
    .locator(".el-popconfirm, .el-popper, .el-message-box")
    .getByRole("button", { name: "确定" })
    .first()
    .click();
  await expect(page.locator(".el-message--success")).toBeVisible();

  const cloneRow = page
    .locator(".el-table__body-wrapper .el-table__row", {
      hasText: `${taskName}-copy`
    })
    .first();
  await expect(cloneRow).toBeVisible({ timeout: 15_000 });
  await expect(cloneRow).toContainText("禁用");
});

test("定时任务：批量停用 → 批量启用", async ({ page }) => {
  const suffix = Date.now();
  const names = [`e2e-batchen-${suffix}-a`, `e2e-batchen-${suffix}-b`];
  await login(page);
  const token = await getAccessToken(page);

  const crontabPk = await createCrontab(page, token);
  for (const name of names) {
    await createPeriodicTask(page, token, name, crontabPk);
  }

  await openMenuPath(
    page,
    ["系统管理", "任务管理"],
    "/system/celery/task/index"
  );
  // 列表按任务名称倒序排列：任务名是 e2e-batchen-<时间戳>-a/-b，时间戳最大，
  // 反而排在全量列表最末尾，双浏览器两波 + 失败重试会把表格堆积到多页，
  // 两条目标任务可能分处两页导致勾选超时。先按唯一前缀检索再操作。
  await searchTaskByName(page, `e2e-batchen-${suffix}`);
  const bodyRow = (name: string) =>
    page
      .locator(".el-table__body-wrapper .el-table__row", { hasText: name })
      .first();

  /** 勾选行（表格刷新会重建 DOM，点击可能落在被替换的节点上，重试兜底） */
  const selectRow = async (name: string) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const checkbox = bodyRow(name).locator(".el-checkbox").first();
      await checkbox.click();
      try {
        await expect(checkbox).toHaveClass(/is-checked/, { timeout: 2_000 });
        return;
      } catch {
        /* DOM 重建吞掉了点击，重试 */
      }
    }
    throw new Error(`勾选行失败: ${name}`);
  };

  // 勾选两条 → 批量停用 → 确认
  for (const name of names) {
    const row = bodyRow(name);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await selectRow(name);
  }
  await page.getByRole("button", { name: "批量停用" }).click();
  await page
    .locator(".el-popconfirm, .el-popper, .el-message-box")
    .getByRole("button", { name: "确定" })
    .first()
    .click();
  await expect(page.locator(".el-message--success")).toBeVisible();
  for (const name of names) {
    await expect(bodyRow(name)).toContainText("禁用", { timeout: 15_000 });
  }

  // 批量启用 → 状态回到启用
  for (const name of names) {
    await selectRow(name);
  }
  await page.getByRole("button", { name: "批量启用" }).click();
  await page
    .locator(".el-popconfirm, .el-popper, .el-message-box")
    .getByRole("button", { name: "确定" })
    .first()
    .click();
  await expect(page.locator(".el-message--success")).toBeVisible();
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
