import { expect, test, type Locator, type Page } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 表格已读行 E2E（RePlusPage 的 viewedRow 开关，系统消息页已开启）：
 * 未读行无 is-viewed → 打开「详情」后行挂 is-viewed（弱化样式）→ 刷新后保持
 * （local 存储按接口路径隔离）→ 自清理删除测试数据。
 *
 * 定位纪律：行内按钮顺序为 编辑/删除/详情（详情为 icon-only），按钮需行 hover 后可见；
 * 建行段与 notice-crud 对齐（级别选择是用户选择器就绪的前置等待，勿省）。
 */

/** 弹窗内选下拉项：按可见选项文案匹配（与 notice-crud 同款） */
async function pickSelectOption(page: Page, dialog: Locator, label: string) {
  const option = page
    .locator(".el-select-dropdown__item")
    .filter({ hasText: label })
    .locator("visible=true")
    .first();
  await expect(option).toBeVisible({ timeout: 10_000 });
  await option.click();
}
test("表格已读行：打开详情后行挂 is-viewed 且刷新保持", async ({ page }) => {
  const title = `E2E已读-${Date.now()}`;
  await login(page);
  await openMenuPath(page, ["系统管理", "通知公告"], "/system/notice/index");

  const table = page.locator(".el-table").first();
  await expect(table).toBeVisible({ timeout: 15_000 });

  // 建一条测试数据（通知类型默认「用户通知」必须选择用户）
  await page.getByRole("button", { name: "新增" }).first().click();
  const dialog = page.locator(".el-dialog:visible");
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByPlaceholder("请输入标题").first().fill(title);
  // 通知级别（notice_level 字典下发）
  await dialog.locator(".el-select").first().click();
  await pickSelectOption(page, dialog, "普遍通知");
  // 通知类型保持默认「用户通知」时必须选择用户：api-search-user 表格弹层
  const userSelect = dialog.locator(".el-select").last();
  await expect(userSelect).toBeVisible();
  await userSelect.click();
  const pickerTable = page.locator(".el-table").last();
  await pickerTable
    .locator(".el-table__row")
    .first()
    .waitFor({ state: "visible", timeout: 15_000 });
  await page
    .locator(".el-loading-mask:visible")
    .first()
    .waitFor({ state: "hidden", timeout: 15_000 })
    .catch(() => undefined);
  await pickerTable
    .locator(".el-table__row")
    .first()
    .locator(".el-checkbox")
    .first()
    .click();
  await page.getByRole("button", { name: "确定" }).last().click();
  const editor = dialog.locator("[contenteditable='true']").first();
  await editor.click();
  await page.keyboard.type("已读行 E2E 正文");
  await dialog
    .getByRole("button", { name: /保存|确定/ })
    .first()
    .click();
  await expect(page.locator(".el-dialog:visible")).toHaveCount(0, {
    timeout: 15_000
  });

  // 未读：新行无 is-viewed
  const row = page.locator(".el-table__row", { hasText: title }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row).not.toHaveClass(/is-viewed/);

  // 打开详情（行内第 3 个按钮）→ 关闭弹窗
  await row.hover();
  await row.locator("button").nth(2).click();
  const detailDialog = page.locator(".el-dialog:visible");
  await expect(detailDialog).toBeVisible({ timeout: 10_000 });
  await detailDialog.locator(".el-dialog__headerbtn").first().click();
  await expect(page.locator(".el-dialog:visible")).toHaveCount(0, {
    timeout: 10_000
  });

  // 已读：行挂 is-viewed（操作命中即标记）
  await expect(row).toHaveClass(/is-viewed/, { timeout: 10_000 });

  // 刷新保持：local 存储跨刷新读回（同接口路径作用域）
  await page.reload();
  const rowAfterReload = page
    .locator(".el-table__row", { hasText: title })
    .first();
  await expect(rowAfterReload).toBeVisible({ timeout: 15_000 });
  await expect(rowAfterReload).toHaveClass(/is-viewed/, { timeout: 10_000 });

  // 自清理：删除测试数据（双浏览器共享库下保持幂等）
  await rowAfterReload.hover();
  await rowAfterReload.getByRole("button", { name: "删除" }).first().click();
  const confirm = page
    .locator(".el-popconfirm, .el-popper")
    .getByRole("button", { name: "确定" })
    .first();
  await expect(confirm).toBeVisible({ timeout: 10_000 });
  await confirm.click();
  await expect(page.locator(".el-table__row", { hasText: title })).toHaveCount(
    0,
    { timeout: 15_000 }
  );
});
