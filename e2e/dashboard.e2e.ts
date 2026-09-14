import { expect, test, type Page } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 数据集 + 仪表盘主链路：
 * 建数据集（绑定 system.userinfo）→ 建仪表盘 → 添加数字卡片 → 保存布局 →
 * 卡片标题与统计渲染。聚合图表由后端集成测试覆盖数据形态，E2E 走 UI 链路。
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

test("数据集 + 仪表盘主链路", async ({ page }) => {
  await login(page);

  // 名称唯一约束（Dataset/Dashboard.name unique）+ 双浏览器共享同一 sqlite 库：
  // 固定名字会让后跑的浏览器撞唯一约束（曾表现为 webkit 稳定失败、隔离复跑才过），
  // 统一加随机后缀防冲突（e2e/README「历史教训速查」同款处置）
  const suffix = Math.random().toString(36).slice(2, 8);
  const datasetName = `E2E数据集-${suffix}`;
  const dashboardName = `E2E看板-${suffix}`;

  // ---- 建数据集 ----
  await openMenuPath(page, ["数据分析"], "/analysis/dataset/index");
  await expect(page.getByTestId("dataset-table")).toBeVisible({
    timeout: 15_000
  });

  await page.getByRole("button", { name: "新建数据集" }).click();
  const dialog = page.locator(".el-dialog").filter({ hasText: "新建数据集" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("名称").fill(datasetName);
  await pickSelectOption(page, "绑定模型", "system.userinfo");
  await pickSelectOption(page, "数据列", "username");
  await dialog.getByRole("button", { name: "确认" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByTestId("dataset-table").getByText(datasetName)
  ).toBeVisible();

  // ---- 建仪表盘并加卡片 ----
  await openMenuPath(page, ["数据分析"], "/analysis/dashboard/index");
  await page.getByRole("button", { name: "新建仪表盘" }).first().click();
  const dashDialog = page
    .locator(".el-dialog")
    .filter({ hasText: "新建仪表盘" });
  await dashDialog.getByLabel("仪表盘名称").fill(dashboardName);
  await dashDialog.getByRole("button", { name: "确认" }).click();
  await expect(dashDialog).not.toBeVisible();

  await page.getByRole("button", { name: "编辑布局" }).click();
  await page.getByRole("button", { name: "添加卡片" }).click();
  const cardDialog = page.locator(".el-dialog").filter({ hasText: "添加卡片" });
  await expect(cardDialog).toBeVisible();
  await pickSelectOption(page, "数据集", datasetName);
  await cardDialog.getByLabel("卡片标题").fill("用户总数");
  await cardDialog.getByRole("button", { name: "确认" }).click();
  await expect(cardDialog).not.toBeVisible();

  await page.getByRole("button", { name: "保存布局" }).click();
  await expect(page.getByText("保存成功").first()).toBeVisible();
  // 卡片渲染：标题 + 数字卡内容（total 为系统用户数，E2E 种子环境 > 0）
  const card = page.locator(".el-card").filter({ hasText: "用户总数" });
  await expect(card).toBeVisible();
  await expect(card.locator(".text-3xl")).toHaveText(/\d+/);
});
