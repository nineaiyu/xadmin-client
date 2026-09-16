import { expect, test, type Page } from "@playwright/test";

import { FRONT_URL, login, openMenuPath } from "./helpers";

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
  // 该弹层是「输入 + 搜索按钮」形态（非实时过滤）：不点搜索则列表保持默认首页
  // （pageSize=15 + ordering=-created_time，全量并行下其他用例创建的用户会把早建的
  // 种子用户挤出首页 → 目标行不可见）；单跑用户少时恰好命中首页，问题被掩盖
  await page
    .getByRole("tooltip")
    .filter({ has: pickerSearch })
    .getByRole("button", { name: "搜索" })
    .click();
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

/**
 * 幂等前置：清理目标委托人的历史委托记录。
 *
 * 后端对「同一委托人时间重叠的生效委托」直接拒绝（解析歧义兜底），而本用例
 * 数据固定（同一委托人 + 固定时段）；双浏览器共享同一 E2E 库、且用例可重复
 * 运行，残留记录会让下一次保存被拒（弹窗停留在保存态、不关闭）。
 */
async function cleanupDelegationsOf(page: Page, delegatorName: string) {
  // 后端 router 为 SimpleRouter(False)：路由不带尾斜杠（带斜杠会 404，见 e2e/README）
  const resp = await page.request.get(
    `${FRONT_URL}/api/system/approval-delegations?size=100`
  );
  const body = await resp.json();
  const rows = (body?.data?.results ?? []) as Array<{
    pk: string;
    delegator_name: string;
  }>;
  for (const row of rows) {
    if (row.delegator_name === delegatorName) {
      const deleted = await page.request.delete(
        `${FRONT_URL}/api/system/approval-delegations/${row.pk}`
      );
      expect(deleted.ok()).toBeTruthy();
    }
  }
}

test("审批委托：代理人远程联想 + 委托人弹窗选择 → 保存 → 回显", async ({
  page
}) => {
  // 双浏览器共享同一 E2E 库：各用独立委托人，避免「同一委托人时间重叠」校验互相拒绝
  const delegator =
    test.info().project.name === "webkit" ? "e2e_member" : "e2e_user";
  await login(page);
  // 重复运行幂等：清理该委托人的历史记录（残留会让本次保存被重叠校验拒绝）
  await cleanupDelegationsOf(page, delegator);
  await openMenuPath(page, ["系统管理"], "/system/approval/delegation/index");
  const table = page.locator(".el-table").first();
  await expect(table).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "新增" }).first().click();
  const dialog = page.locator(".el-dialog:visible").first();
  await expect(dialog).toBeVisible({ timeout: 15_000 });

  // 委托人：未入联想白名单 → 仍是弹窗选择器（下拉内是表格，无联想候选输入行为）
  await pickFromDialog(page, "委托人", delegator);

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
  await expect(row).toContainText(delegator, { timeout: 15_000 });
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
  ).toContainText(delegator, { timeout: 10_000 });
  await dialogAgain.locator(".el-dialog__headerbtn").first().click();
  await expect(dialogAgain).not.toBeVisible({ timeout: 15_000 });
});
