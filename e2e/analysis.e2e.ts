import { expect, test, type Page } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 数据分析二期主链路：
 * 建数据集 → 建看板+卡片（投屏素材）→ 建报表并立即运行（状态落 SUCCESS*，
 * 邮件后端缺失时走 SUCCESS_WITH_EMAIL_ERROR 降级）→ 建大屏并投屏（全屏页渲染卡片）。
 */

const pickSelectOption = async (
  page: Page,
  formLabel: string,
  optionText: string
) => {
  await page
    .locator(`.el-dialog .el-form-item:has-text('${formLabel}') .el-select`)
    .first()
    .click();
  await page
    .locator(".el-select-dropdown:visible .el-select-dropdown__item", {
      hasText: optionText
    })
    .first()
    .click();
};

test("报表与大屏主链路", async ({ page }) => {
  await login(page);

  // 名称唯一约束（Dataset/Dashboard/Report/Screen.name unique）+ 双浏览器共享同一
  // sqlite 库：固定名字会让后跑的浏览器撞唯一约束（曾表现为 webkit 稳定失败、隔离
  // 复跑才过），统一加随机后缀防冲突（e2e/README「历史教训速查」同款处置）
  const suffix = Math.random().toString(36).slice(2, 8);
  const datasetName = `E2E报表数据集-${suffix}`;
  const dashboardName = `E2E投屏看板-${suffix}`;
  const reportName = `E2E日报-${suffix}`;
  const screenName = `E2E大屏-${suffix}`;

  // ---- 素材：数据集 ----
  await openMenuPath(page, ["数据分析"], "/analysis/dataset/index");
  await expect(page.getByTestId("dataset-table")).toBeVisible({
    timeout: 15_000
  });
  await page.getByRole("button", { name: "新建数据集" }).click();
  const dsDialog = page.locator(".el-dialog").filter({ hasText: "新建数据集" });
  await dsDialog.getByLabel("名称").fill(datasetName);
  await pickSelectOption(page, "绑定模型", "system.userinfo");
  await pickSelectOption(page, "数据列", "username");
  // C5 收敛后弹窗按钮文案统一为框架口径「保存」（原手写弹窗为「确认」）
  await dsDialog.getByRole("button", { name: "保存" }).click();
  await expect(dsDialog).not.toBeVisible();

  // ---- 素材：看板 + 数字卡片 ----
  await openMenuPath(page, ["数据分析"], "/analysis/dashboard/index");
  await page.getByRole("button", { name: "新建仪表盘" }).first().click();
  const dashDialog = page
    .locator(".el-dialog")
    .filter({ hasText: "新建仪表盘" });
  await dashDialog.getByLabel("仪表盘名称").fill(dashboardName);
  // C5 收敛后弹窗按钮文案统一为框架口径「保存」（原手写弹窗为「确认」）
  await dashDialog.getByRole("button", { name: "保存" }).click();
  await expect(dashDialog).not.toBeVisible();
  await page.getByRole("button", { name: "编辑布局" }).click();
  await page.getByRole("button", { name: "添加卡片" }).click();
  const cardDialog = page.locator(".el-dialog").filter({ hasText: "添加卡片" });
  await pickSelectOption(page, "数据集", datasetName);
  await cardDialog.getByLabel("卡片标题").fill("投屏用户总数");
  await cardDialog.getByRole("button", { name: "保存" }).click();
  await expect(cardDialog).not.toBeVisible();
  await page.getByRole("button", { name: "保存布局" }).click();

  // ---- 报表：创建 + 立即运行 ----
  await openMenuPath(page, ["数据分析"], "/analysis/report/index");
  await page.getByRole("button", { name: "新建报表" }).click();
  const reportDialog = page
    .locator(".el-dialog")
    .filter({ hasText: "新建报表" });
  await reportDialog.getByLabel("名称").fill(reportName);
  await pickSelectOption(page, "数据集", datasetName);
  await reportDialog.getByLabel("收件人").fill("e2e@corp.com");
  // C5 收敛后弹窗按钮文案统一为框架口径「保存」（原手写弹窗为「确认」）
  await reportDialog.getByRole("button", { name: "保存" }).click();
  await expect(reportDialog).not.toBeVisible();

  const reportRow = page.getByRole("row", { name: reportName });
  await expect(reportRow).toBeVisible();
  await reportRow.getByRole("button", { name: "立即运行" }).click();
  await expect(page.getByText("已派发执行").first()).toBeVisible();
  await expect(reportRow.getByText(/SUCCESS/)).toBeVisible({ timeout: 20_000 });

  // ---- 大屏：创建 + 投屏 ----
  await openMenuPath(page, ["数据分析"], "/analysis/screen/index");
  await page.getByRole("button", { name: "新建大屏" }).click();
  const screenDialog = page
    .locator(".el-dialog")
    .filter({ hasText: "新建大屏" });
  await screenDialog.getByLabel("名称").fill(screenName);
  await pickSelectOption(page, "仪表盘序列", dashboardName);
  await screenDialog.getByRole("button", { name: "保存" }).click();
  await expect(screenDialog).not.toBeVisible();

  const screenRow = page.getByRole("row", { name: screenName });
  await screenRow.getByRole("button", { name: "投屏" }).click();
  const screenRoot = page.locator(".screen-root");
  await expect(
    screenRoot.locator("span", { hasText: `${screenName} · ${dashboardName}` })
  ).toBeVisible({ timeout: 15_000 });
  // 轮播页渲染卡片标题与数字
  await expect(screenRoot.getByText("投屏用户总数")).toBeVisible();
});
