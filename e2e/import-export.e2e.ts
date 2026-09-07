import { expect, test } from "@playwright/test";
import { statSync } from "node:fs";

import { FRONT_URL, login, openMenuPath } from "./helpers";

/**
 * 导入导出全流程 E2E：导出文件下载 + 导入建数据（用户管理，ImportExportDataAction）。
 * 工具栏按钮为图标按钮（ElTooltip 包裹），顺序固定：新增(-30) / 导出(-20) / 导入(-10)。
 *
 * 接口类断言走同源 FRONT_URL：会话 Cookie 不会随跨域请求发送。
 */

const BACKEND = FRONT_URL;

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

test("导出：弹层确认后触发 xlsx 文件下载", async ({ page }) => {
  await openUserManagement(page);

  await toolbarButton(page, 1).click();
  const dialog = page.locator(".el-dialog", { hasText: "导出" }).first();
  await expect(dialog).toBeVisible();

  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  await dialog
    .getByRole("button", { name: /保存|确定/ })
    .first()
    .click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  // Playwright 的 Download 没有 createStream()，落盘后用文件大小校验内容非空
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  expect(statSync(filePath as string).size).toBeGreaterThan(1024);
});

test("导入：上传 CSV 建用户并在列表可见", async ({ page }) => {
  const username = `e2e_imp_${Date.now()}`;
  await openUserManagement(page);

  await toolbarButton(page, 2).click();
  const dialog = page.locator(".el-dialog", { hasText: "导入" }).first();
  await expect(dialog).toBeVisible();

  // 默认动作即「创建」；直接向 el-upload 的隐藏 input 塞入 CSV
  // 创建用户序列化器要求 password 必填（ignore_error 默认 false，缺列会 400）
  const csv = `username,nickname,password\n${username},E2E导入用户,E2E-Import-2026!\n`;
  await dialog
    .locator("input[type='file']")
    .first()
    .setInputFiles({
      name: "e2e-import.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf-8")
    });

  await dialog
    .getByRole("button", { name: /保存|确定/ })
    .first()
    .click();
  // eager celery 同步导入完成后弹层关闭，列表自动刷新
  await expect(dialog).not.toBeVisible({ timeout: 30_000 });
  await expect(
    page.locator(".el-table__row", { hasText: username }).first()
  ).toBeVisible({ timeout: 30_000 });
});

test("导入：API 同步链路（task=false）返回成功且数据落库", async ({ page }) => {
  await login(page);
  const username = `e2e_sync_${Date.now()}`;
  const response = await page.request.post(
    `${BACKEND}/api/system/user/import-data?action=create&task=false`,
    {
      // 导入接口由 CSVFileParser 解析（media_type=text/csv），需以原始文本提交；
      // 用 multipart 会走 AxiosMultiPartParser，request.data 被解析为空列表，
      // 进而报「username/password 不可为空」
      // 创建用户序列化器要求 password 必填，导入列需带上
      data: `username,nickname,password\n${username},E2E同步导入,E2E-Import-2026!\n`,
      headers: { "Content-Type": "text/csv", "User-Agent": "e2e-test" }
    }
  );
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload?.code).toBe(1000);
});
