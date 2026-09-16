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
  // RePlusPage 列表以工具栏按钮为加载锚点（表格行需等种子/新建数据）
  await expect(page.getByRole("button", { name: "新建数据集" })).toBeVisible({
    timeout: 15_000
  });

  await page.getByRole("button", { name: "新建数据集" }).click();
  const dialog = page.locator(".el-dialog").filter({ hasText: "新建数据集" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("名称").fill(datasetName);
  await pickSelectOption(page, "绑定模型", "system.userinfo");
  await pickSelectOption(page, "数据列", "username");
  // C5 收敛后弹窗按钮文案统一为框架口径「保存」（原手写弹窗为「确认」）
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("row", { name: datasetName }).first()
  ).toBeVisible({ timeout: 15_000 });

  // ---- 建仪表盘并加卡片 ----
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
  await expect(cardDialog).toBeVisible();
  await pickSelectOption(page, "数据集", datasetName);
  // EP 的单选下拉在选中后并不真正收起（残留 DOM 且拦截后续点击，见 e2e/README），
  // 点弹窗空白头部（下拉上方，不会被其遮挡）触发外部点击收起
  await cardDialog.locator(".el-dialog__header").click();
  await cardDialog.getByLabel("卡片标题").fill("用户总数");
  // 卡片授权面——选一个「可见角色」（多选下拉不自动收起，同样需手动收起）。
  // EP 收起后的下拉仍以可见态残留在 DOM，必须经 aria-controls 精确锁定本下拉的列表
  const rolesSelect = cardDialog
    .locator(".el-form-item")
    .filter({ hasText: "可见角色" })
    .locator(".el-select");
  await rolesSelect.click();
  const rolesCombo = cardDialog.getByRole("combobox", { name: "可见角色" });
  const rolesListId = await rolesCombo.getAttribute("aria-controls");
  expect(rolesListId).not.toBeNull();
  const roleItem = page
    .locator(`[id="${rolesListId}"] .el-select-dropdown__item`)
    .last();
  await expect(roleItem).toBeVisible();
  const roleName = ((await roleItem.textContent()) ?? "").trim();
  expect(roleName).not.toBe("");
  await roleItem.click();
  await expect(rolesSelect.locator(".el-tag").first()).toContainText(roleName);
  await cardDialog.locator(".el-dialog__header").click();
  await cardDialog.getByRole("button", { name: "保存" }).click();
  await expect(cardDialog).not.toBeVisible();

  // 重开卡片设置验证「可见角色」回显（读内存草稿，无需先保存布局；
  // 放在保存布局之前——保存后 dashboards 数组整行替换会重建卡片按钮导致 detached 抖动）
  const card = page.locator(".el-card").filter({ hasText: "用户总数" });
  await expect(card).toBeVisible();
  await card.getByTitle("卡片设置").click();
  const editCardDialog = page
    .locator(".el-dialog")
    .filter({ hasText: "编辑卡片" });
  await expect(editCardDialog).toBeVisible();
  await expect(
    editCardDialog.locator(".el-select").filter({ hasText: roleName }).first()
  ).toBeVisible();
  await editCardDialog.getByRole("button", { name: "关闭此对话框" }).click();
  await expect(editCardDialog).not.toBeVisible();

  await page.getByRole("button", { name: "保存布局" }).click();
  await expect(page.getByText("保存成功").first()).toBeVisible();
  // 卡片渲染：标题 + 数字卡内容（total 为系统用户数，E2E 种子环境 > 0）
  await expect(card).toBeVisible();
  await expect(card.locator(".text-3xl")).toHaveText(/\d+/);

  // 卡片宽度档位是 12 栅格（默认 6 → 6/12），渲染到 el-col 需换算为 24 栅格：
  // 默认半宽 ≈ 0.5（曾直接透传导致实渲染只有标称一半，见 views/dashboard/utils/span.ts）
  const rowBox = await page.getByTestId("dashboard-cards").boundingBox();
  const colBox = await page
    .getByTestId("dashboard-cards")
    .locator(".el-col")
    .first()
    .boundingBox();
  const ratio = (colBox?.width ?? 0) / (rowBox?.width ?? 1);
  expect(ratio).toBeGreaterThan(0.4);
  expect(ratio).toBeLessThan(0.6);
});
