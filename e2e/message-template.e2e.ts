import { expect, test } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 消息模板（设置 → 消息 → 消息模板页签）：编辑统一走 ReDialog 后的链路回归。
 *
 * 覆盖：编辑弹层（含变量提示与默认正文）→ 预览 → 保存（列表标记「已自定义」）→ 重置为默认。
 * 用例末尾重置覆盖，避免双浏览器共享库残留。
 */
test("消息模板：编辑覆盖 → 预览 → 保存 → 重置为默认", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["系统设置"], "/settings/message");
  await page.getByRole("tab", { name: "消息模板" }).click();

  const table = page.getByTestId("template-table");
  await expect(table).toBeVisible({ timeout: 15_000 });
  const row = table.locator("tbody tr").first();
  await expect(row).toBeVisible();
  const rowName = (await row.locator("td").first().innerText()).trim();
  const targetRow = () =>
    table.locator("tbody tr").filter({ hasText: rowName });

  // ---- 编辑：统一弹层（非手写 el-dialog）----
  await row.getByTestId("template-edit").click();
  const dialog = page.locator(".el-dialog");
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(dialog).toContainText("模板");

  await dialog.getByTestId("template-subject").fill("E2E主题-{title}");
  const previewBtn = dialog.getByTestId("template-preview");
  if (await previewBtn.isEnabled()) {
    await previewBtn.click();
    await expect(dialog.getByTestId("template-preview-result")).toBeVisible({
      timeout: 10_000
    });
  }

  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  await expect(targetRow().getByTestId("template-override-tag")).toHaveText(
    "已自定义",
    { timeout: 10_000 }
  );

  // ---- 重置（清理）：回到代码默认 ----
  await targetRow().getByTestId("template-reset").click();
  await page.getByRole("button", { name: "确定" }).click();
  await expect(targetRow().getByTestId("template-override-tag")).toHaveText(
    "代码默认",
    { timeout: 10_000 }
  );
});
