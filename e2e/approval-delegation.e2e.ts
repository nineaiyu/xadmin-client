import { expect, test } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 审批委托（审批流三期）：页面主链路。
 *
 * 解析语义（生效替换 / 期外回落 / 流程范围 / 申请人剔除 / 不递归防环）
 * 由后端集成测试 tests/integration/system/test_approval_delegation.py 覆盖；
 * 本用例验证菜单可达、列表页渲染与新建入口。
 */
test("审批委托：菜单可达 + 列表与新建入口渲染", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  await openMenuPath(page, ["审批"], "/approval/delegation/index");
  await expect(page.getByText("审批委托").first()).toBeVisible({
    timeout: 20_000
  });
  await expect(
    page.getByRole("button", { name: /新\s*(建|增)/ }).first()
  ).toBeVisible({ timeout: 20_000 });

  // 新建弹窗：流程范围是流程多选（替代 JSONField 手填），选项来自流程清单
  await page
    .getByRole("button", { name: /新\s*(建|增)/ })
    .first()
    .click();
  const dialog = page.locator(".el-dialog:visible").last();
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  const flowItem = dialog
    .locator(".el-form-item")
    .filter({ hasText: "流程范围" })
    .first();
  await expect(flowItem.locator(".el-select")).toBeVisible({ timeout: 20_000 });
  await flowItem.locator(".el-select").click();
  await expect(
    page
      .locator(".el-select-dropdown:visible .el-select-dropdown__item")
      .first()
  ).toBeVisible({ timeout: 20_000 });
});
