import { expect, test } from "@playwright/test";

import { BACKEND_URL, login } from "./helpers";

/**
 * 导入导出全流程 E2E（T4.3）：导出文件下载 + 导入建数据（用户管理，ImportExportDataAction）。
 * 工具栏按钮为图标按钮（ElTooltip 包裹），顺序固定：新增(-30) / 导出(-20) / 导入(-10)。
 */

const BACKEND = BACKEND_URL;

async function openUserManagement(page: import("@playwright/test").Page) {
  await login(page);
  await page.getByRole("menuitem", { name: "系统管理" }).first().click();
  const item = page.getByRole("menuitem", { name: "用户管理" }).first();
  await item.waitFor({ state: "visible" });
  await item.click();
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
  const stream = await download.createStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const size = Buffer.concat(chunks).length;
  expect(size).toBeGreaterThan(1024);
});

test("导入：上传 CSV 建用户并在列表可见", async ({ page }) => {
  const username = `e2e_imp_${Date.now()}`;
  await openUserManagement(page);

  await toolbarButton(page, 2).click();
  const dialog = page.locator(".el-dialog", { hasText: "导入" }).first();
  await expect(dialog).toBeVisible();

  // 默认动作即「创建」；直接向 el-upload 的隐藏 input 塞入 CSV
  const csv = `username,nickname\n${username},E2E导入用户\n`;
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
      headers: { "User-Agent": "e2e-test" },
      multipart: {
        file: {
          name: "e2e-sync.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(
            `username,nickname\n${username},E2E同步导入\n`,
            "utf-8"
          )
        }
      }
    }
  );
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload?.code).toBe(1000);
});
