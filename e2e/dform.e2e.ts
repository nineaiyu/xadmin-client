import { expect, test } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 动态表单主链路：
 * 管理员设计表单（两个控件 + 提交需审批）→ 用户填报 → 我的提交列表可见 → 提交内容渲染。
 *
 * 审批开关本身走「设计器 → 列表 → 填报卡片」往返（超管直提，不触发 412）；
 * 412 → 审批通过 → 令牌重放的完整链路在集成测试与审批 E2E 覆盖。
 */

test("动态表单：设计（含审批开关）→ 填报 → 提交可见", async ({ page }) => {
  await login(page);

  // ---- 设计表单 ----
  await openMenuPath(page, ["表单采集"], "/form-collection/designer/index");
  await expect(page.getByTestId("form-designer-table")).toBeVisible({
    timeout: 15_000
  });
  await page.getByRole("button", { name: "新建表单" }).click();
  const dialog = page.locator(".el-dialog").filter({ hasText: "新建表单" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("名称").fill("E2E设备登记");
  // 开启「提交审批」，落库后列表与填报页均带「需审批」标记
  await dialog.getByTestId("form-approval-switch").click();
  await dialog.getByRole("button", { name: "添加字段" }).click();
  const firstRow = dialog.locator(".el-table__row").first();
  await firstRow.locator("input").first().fill("device_name");
  await firstRow.locator("input").nth(1).fill("设备名称");
  await dialog.getByRole("button", { name: "添加字段" }).click();
  const secondRow = dialog.locator(".el-table__row").nth(1);
  await secondRow.locator("input").first().fill("location");
  await secondRow.locator("input").nth(1).fill("存放位置");
  // C5 收敛后弹窗按钮文案统一为框架口径「保存」（原手写弹窗为「确认」）
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByTestId("form-designer-table").getByText("E2E设备登记")
  ).toBeVisible();
  // 审批开关已落库：设计器列表该行显示「需审批」
  await expect(
    page
      .getByTestId("form-designer-table")
      .getByRole("row", { name: /E2E设备登记/ })
      .getByText("需审批")
  ).toBeVisible({ timeout: 15_000 });

  // ---- 填报 ----
  await openMenuPath(page, ["表单采集"], "/form-collection/my/index");
  const card = page
    .getByTestId("fill-form-card")
    .filter({ hasText: "E2E设备登记" });
  await expect(card).toBeVisible({ timeout: 15_000 });
  // 填报卡片带「需审批」标记，弹窗内提示审批语义
  await expect(card.getByTestId("fill-form-approval-tag")).toBeVisible();
  await card.click();
  const fillDialog = page.locator(".el-dialog");
  await expect(fillDialog).toBeVisible();
  await fillDialog.getByLabel("设备名称").fill("E2E路由器");
  await fillDialog.getByLabel("存放位置").fill("A 机房 01 柜");
  // C5 收敛后弹窗按钮文案统一为框架口径「保存」（原手写弹窗为「确认」）
  await fillDialog.getByRole("button", { name: "保存" }).click();
  await expect(fillDialog).not.toBeVisible();

  // ---- 我的提交可见且内容渲染 ----
  const submissionRow = page
    .getByTestId("my-submission-table")
    .getByRole("row", { name: /E2E设备登记/ });
  await expect(submissionRow).toBeVisible();
  await expect(page.getByText("device_name: E2E路由器")).toBeVisible();
});
