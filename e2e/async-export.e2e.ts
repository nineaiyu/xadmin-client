import { expect, test } from "@playwright/test";
import { statSync } from "node:fs";

import { login, openMenuPath } from "./helpers";

/**
 * 异步导出 + 下载中心全流程（用户管理，export-async action）：
 * 弹层开启「异步导出」→ 提交任务 → 下载中心出现成功记录 → 鉴权下载文件。
 * E2E 环境（CELERY_TASK_ALWAYS_EAGER）下任务同步执行，记录提交后即为成功。
 */

async function openUserManagement(page: import("@playwright/test").Page) {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/user/index");
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });
}

function toolbarButton(page: import("@playwright/test").Page, index: number) {
  return page
    .locator("div.flex.mr-4")
    .first()
    .locator("button.el-button")
    .nth(index);
}

test("异步导出：提交任务并在下载中心出现记录可下载", async ({ page }) => {
  await openUserManagement(page);

  await toolbarButton(page, 1).click();
  const dialog = page.locator(".el-dialog", { hasText: "导出" }).first();
  await expect(dialog).toBeVisible();

  // 打开「异步导出」开关（PlusForm 的 switch 控件）
  await dialog.locator(".el-switch").first().click();
  await dialog
    .getByRole("button", { name: /保存|确定/ })
    .first()
    .click();

  // 提交成功提示（eager 环境任务同步完成）
  await expect(
    page.locator(".el-message", { hasText: "导出任务已提交" }).first()
  ).toBeVisible({ timeout: 15_000 });
  await expect(dialog).not.toBeVisible({ timeout: 15_000 });

  // 下载中心：记录存在且状态为成功（导出文件名为 <model_name>_<时间戳>，用户模型即 userinfo_）
  await openMenuPath(page, ["系统管理"], "/system/export/index");
  const row = page.locator(".el-table__row", { hasText: "userinfo_" }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row).toContainText("成功");

  // 鉴权下载：走 download action 而非 /media/ 直出
  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  await row.getByRole("button", { name: "下载" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  expect(statSync(filePath as string).size).toBeGreaterThan(100);
});
