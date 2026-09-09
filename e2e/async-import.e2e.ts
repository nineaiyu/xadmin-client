import { expect, test } from "@playwright/test";
import { statSync } from "node:fs";

import { login, openMenuPath } from "./helpers";

/**
 * 异步导入 2.0 全流程（用户管理，import-validate / import-async action）：
 * ① 仅校验：非法行精确定位且不落库；② 异步导入：提交任务 → 下载中心
 * 「导入记录」页签出现记录 → 下载失败行错误报告。
 * E2E 环境（CELERY_TASK_ALWAYS_EAGER）下任务同步执行，提交后即为终态。
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

async function openImportDialog(page: import("@playwright/test").Page) {
  await toolbarButton(page, 2).click();
  const dialog = page.locator(".el-dialog", { hasText: "导入" }).first();
  await expect(dialog).toBeVisible();
  return dialog;
}

async function uploadCsv(
  dialog: ReturnType<import("@playwright/test").Page["locator"]>,
  csv: string
) {
  await dialog
    .locator("input[type='file']")
    .first()
    .setInputFiles({
      name: "e2e-async-import.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf-8")
    });
}

test("仅校验：非法行精确定位且不落库", async ({ page }) => {
  const username = `e2e_vali_${Date.now()}`;
  await openUserManagement(page);
  const dialog = await openImportDialog(page);

  // 切到「仅校验」：第 2 行缺 password 列（创建必填）→ 校验失败
  await dialog.getByText("仅校验").first().click();
  await uploadCsv(
    dialog,
    `username,nickname,password\n${username},E2E校验用户,E2E-Import-2026!\n${username}_bad,缺密码\n`
  );
  await dialog
    .getByRole("button", { name: /保存|确定/ })
    .first()
    .click();

  // 校验结果弹窗：2 行总数、1 行失败
  const resultDialog = page
    .locator(".el-dialog", { hasText: "导入校验结果" })
    .first();
  await expect(resultDialog).toBeVisible({ timeout: 30_000 });
  await expect(resultDialog).toContainText("共 2 行");
  await expect(resultDialog).toContainText("失败 1 行");
  await resultDialog
    .locator(".el-dialog__headerbtn, .el-dialog__header-close")
    .first()
    .click();

  // 校验不落库：合法行也不应出现在列表
  await page
    .getByPlaceholder(/搜索|输入关键字/)
    .first()
    .fill(username)
    .catch(() => undefined);
  await expect(
    page.locator(".el-table__row", { hasText: username }).first()
  ).toHaveCount(0);
});

test("异步导入：提交任务并在下载中心「导入记录」出现记录可下载错误报告", async ({
  page
}) => {
  const username = `e2e_aimp_${Date.now()}`;
  await openUserManagement(page);
  const dialog = await openImportDialog(page);

  // 行 2 与行 1 用户名重复 → 任务内失败 1 行（逐行 savepoint 隔离，行 1 成功）
  const csv =
    `username,nickname,password\n${username},E2E异步导入,E2E-Import-2026!\n` +
    `${username},重复用户,E2E-Import-2026!\n`;
  await uploadCsv(dialog, csv);

  // 打开「异步导入」开关（PlusForm switch，与异步导出同款交互）
  await dialog.locator(".el-switch").first().click();
  await dialog
    .getByRole("button", { name: /保存|确定/ })
    .first()
    .click();

  // eager 环境任务同步执行完成；弹窗关闭即提交成功（记录在下载中心断言）
  await expect(dialog).not.toBeVisible({ timeout: 30_000 });

  // 下载中心 → 「导入记录」页签：记录存在、成功（部分失败也终态 SUCCESS）
  await openMenuPath(page, ["系统管理"], "/system/export/index");
  await page.getByRole("tab", { name: "导入记录" }).first().click();
  const row = page.locator(".el-table__row", { hasText: "import_" }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row).toContainText("成功");

  // 下载失败行错误报告（xlsx）
  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  await row.getByRole("button", { name: "错误报告" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/_errors\.xlsx$/);
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  expect(statSync(filePath as string).size).toBeGreaterThan(100);
});
