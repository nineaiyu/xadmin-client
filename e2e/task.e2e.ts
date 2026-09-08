import { expect, test } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 定时任务管理页 E2E（业务侧 celery beat CRUD）。
 * 演示任务由 scripts/e2e_seed.py 种入（E2E-演示清理任务，默认停用）。
 * 验收口径：页面渲染 + 一次启停循环（开关经 PATCH partialUpdate 落库）。
 */
const SEED_TASK = "E2E-演示清理任务";

test("定时任务：列表渲染与启停开关循环", async ({ page }) => {
  await login(page);
  await openMenuPath(
    page,
    ["系统管理", "任务管理"],
    "/system/celery/task/index"
  );
  const table = page.locator(".el-table");
  await expect(table).toBeVisible({ timeout: 15_000 });

  // 种子任务行可见（业务侧管理页替代 Django Admin 兜底入口）
  const row = page.locator(".el-table__row", { hasText: SEED_TASK }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });

  // 启停循环：boolean 列渲染为 el-switch，每次切换都会弹出确认 MessageBox
  // （RePlusPage onSwitchChange → ElMessageBox.confirm），确认后才 PATCH 落库。
  // 该版本 el-switch 不在根节点写 aria-checked，用 is-checked class 判定
  const toggle = row.locator(".el-switch").first();
  await expect(toggle).toBeVisible();
  const confirmButton = page
    .locator(".el-message-box")
    .getByRole("button", { name: "确定" });
  const isChecked = () =>
    toggle.evaluate(el => el.classList.contains("is-checked"));
  const initial = await isChecked();

  await toggle.click();
  await confirmButton.click();
  await expect.poll(isChecked, { timeout: 15_000 }).toBe(!initial);

  // 复原，保持种子状态稳定
  await toggle.click();
  await confirmButton.click();
  await expect.poll(isChecked, { timeout: 15_000 }).toBe(initial);
});

test("Cron 表达式：页面渲染", async ({ page }) => {
  await login(page);
  await openMenuPath(
    page,
    ["系统管理", "任务管理"],
    "/system/celery/crontab/index"
  );
  await expect(page.locator(".el-table, .el-empty").first()).toBeVisible({
    timeout: 15_000
  });
});
