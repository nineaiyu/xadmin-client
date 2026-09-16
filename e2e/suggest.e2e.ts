import { expect, test, type Page } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 远程联想：`api-search-*` 关联字段在元数据下发 suggest_url 后由「弹窗选择器」
 * 升级为「输入联想」（候选集 = 引用方 ViewSet /suggestions，权限回落 list
 * 权限点，字段白名单 = ViewSet 的 suggestion_fields）。
 * 消费方：审批委托——代理人（delegate）走联想；委托人（delegator）未入白名单，
 * 保持弹窗选择器（选中后 tag 显示「昵称(用户名)」）。
 */

/** 弹窗选择器（RePlusSearch）：展开 → 勾选指定用户行 → 确定 */
async function pickFromDialog(
  page: Page,
  formItemText: string,
  username: string
) {
  const wrapper = page
    .locator(".el-dialog:visible")
    .first()
    .locator(`.el-form-item:has-text('${formItemText}')`)
    .first()
    .locator(".el-select__wrapper")
    .first();
  await wrapper.click();
  // 弹层表格交互（沿用 config-persist 先例）：选择器内搜索框精确定位目标行，
  // 等待 loading 遮罩消失（残留下拉/loading 会拦截点击），勾选行内 checkbox
  const pickerSearch = page.getByPlaceholder("请输入用户名");
  await pickerSearch.waitFor({ state: "visible", timeout: 15_000 });
  await pickerSearch.fill(username);
  const pickerTable = page.locator(".el-table").last();
  const pickerRow = pickerTable
    .locator(".el-table__row")
    .filter({ hasText: username })
    .first();
  await expect(pickerRow).toBeVisible({ timeout: 15_000 });
  await page
    .locator(".el-loading-mask:visible")
    .first()
    .waitFor({ state: "hidden", timeout: 15_000 })
    .catch(() => undefined);
  // 单选（multiple=false）无 selection 列：rowClick 直接设值 {pk,label}
  await pickerRow.click();
  await page
    .locator(".el-select__popper:visible")
    .getByRole("button", { name: "确定" })
    .first()
    .click();
  // 已选回显（form-item 级断言：selected-item 第一个可能是隐藏的 input-wrapper）
  await expect(
    page
      .locator(".el-dialog:visible")
      .first()
      .locator(`.el-form-item:has-text('${formItemText}')`)
      .first()
  ).toContainText(username, { timeout: 10_000 });
}

test("审批委托：代理人远程联想 + 委托人弹窗选择 → 保存 → 回显", async ({
  page
}) => {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/approval/delegation/index");
  const table = page.locator(".el-table").first();
  await expect(table).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "新增" }).first().click();
  const dialog = page.locator(".el-dialog:visible").first();
  await expect(dialog).toBeVisible({ timeout: 15_000 });

  // 委托人：未入联想白名单 → 仍是弹窗选择器（下拉内是表格，无联想候选输入行为）
  await pickFromDialog(page, "委托人", "e2e_user");

  // 代理人：远程联想（/suggestions）。EP filterable 输入框 fill + 键盘选中
  const delegateInput = dialog
    .locator(".el-form-item:has-text('代理人')")
    .first()
    .locator(".el-select__input")
    .first();
  const suggestResp = page
    .waitForResponse(r => r.url().includes("/suggestions"))
    .catch(() => null);
  await delegateInput.fill("e2e_leader");
  const suggested = await suggestResp;
  expect(suggested?.status()).toBe(200);
  const suggestedBody = (await suggested?.json()) as {
    data: Array<{ pk: number | string; label: string }>;
  };
  expect(suggestedBody?.data?.length).toBeGreaterThan(0);
  const listId = await delegateInput.getAttribute("aria-controls");
  await expect(
    page.locator(`[id="${listId}"] .el-select-dropdown__item`).first()
  ).toBeVisible({ timeout: 10_000 });
  await delegateInput.press("ArrowDown");
  await delegateInput.press("Enter");

  // 生效/失效时间（必填，失效晚于生效）
  await dialog
    .locator(".el-form-item:has-text('生效时间')")
    .first()
    .locator("input")
    .first()
    .fill("2026-09-20 08:00:00");
  await page.keyboard.press("Enter");
  await dialog
    .locator(".el-form-item:has-text('失效时间')")
    .first()
    .locator("input")
    .first()
    .fill("2026-09-25 08:00:00");
  await page.keyboard.press("Enter");

  await dialog
    .getByRole("button", { name: /保存|确定/ })
    .first()
    .click();
  await expect(dialog).not.toBeVisible({ timeout: 15_000 });

  // 列表首行（ordering=-created_time）回显委托人与代理人
  const row = table.locator(".el-table__row").first();
  await expect(row).toContainText("e2e_user", { timeout: 15_000 });
  await expect(row).toContainText("e2e_leader", { timeout: 15_000 });

  // 二次编辑：代理人已选 {pk,label} 直接回显，不依赖远程候选
  await row.getByRole("button", { name: "编辑" }).first().click();
  const dialogAgain = page.locator(".el-dialog:visible").first();
  await expect(dialogAgain).toBeVisible({ timeout: 15_000 });
  await expect(
    dialogAgain.locator(".el-form-item:has-text('代理人')").first()
  ).toContainText("e2e_leader", { timeout: 10_000 });
  await expect(
    dialogAgain.locator(".el-form-item:has-text('委托人')").first()
  ).toContainText("e2e_user", { timeout: 10_000 });
  await dialogAgain.locator(".el-dialog__headerbtn").first().click();
  await expect(dialogAgain).not.toBeVisible({ timeout: 15_000 });
});
