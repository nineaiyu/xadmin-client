import { expect, test } from "@playwright/test";

import {
  clickPanelAction,
  login,
  openEntityPanel,
  openMenuPath
} from "./helpers";

/**
 * 部门管理行操作抽屉：
 * - 操作列收敛为「编辑 / 删除 / 管理」，行内「分配角色权限 / 部门管理员 / 权限预览」
 *   与默认「查看」入口并入抽屉（与用户管理抽屉同范式）；
 * - 抽屉内按语义分组渲染动作，权限缺失的动作不渲染、空分组剔除；
 * - 动作执行前先收起抽屉再打开二级弹层。
 *
 * 共享库幂等：断言锚定 E2E 种子部门（E2E-主管测试部）与固定权限面，
 * 用例内不修改数据，双浏览器第二段与后续用例互不影响。
 */
test.use({ viewport: { width: 1280, height: 1080 } });

const DEPT_NAME = "E2E-主管测试部";

test("部门抽屉：管理入口、分组动作与二级弹层", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/dept/index");
  const row = page
    .locator(".el-table__row")
    .filter({ hasText: DEPT_NAME })
    .first();
  await expect(row).toBeVisible({ timeout: 10_000 });

  // 操作列只保留编辑 / 删除 / 管理（默认「查看」已并入抽屉，无「更多」折叠）
  await expect(row.getByRole("button", { name: "编辑" })).toBeVisible();
  await expect(row.getByRole("button", { name: "删除" })).toBeVisible();
  await expect(row.locator(".el-dropdown")).toHaveCount(0);

  const drawer = await openEntityPanel(page, row);
  await expect(drawer).toContainText(`管理部门 ${DEPT_NAME}`);
  await expect(drawer).toContainText("权限与角色");
  await expect(drawer).toContainText("成员与管理");
  await expect(drawer).toContainText("记录与审计");
  await expect(drawer.locator('[data-action-code="empower"]')).toBeVisible();
  await expect(
    drawer.locator('[data-action-code="assignManagers"]')
  ).toBeVisible();
  await expect(drawer.locator('[data-action-code="preview"]')).toBeVisible();
  await expect(
    drawer.locator('[data-action-code="changeHistory"]')
  ).toBeVisible();

  // 抽屉内动作：先收起抽屉再打开二级弹层（权限预览为同体系 70% 抽屉）
  await clickPanelAction(drawer, "preview");
  const preview = page
    .locator(".el-drawer")
    .filter({ hasText: "部门授权预览" })
    .first();
  await expect(preview).toBeVisible({ timeout: 15_000 });
  await preview.locator(".el-drawer__close-btn").click();
  await expect(preview).not.toBeVisible();
});

test("部门抽屉：变更历史经抽屉入口打开", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/dept/index");
  const row = page
    .locator(".el-table__row")
    .filter({ hasText: DEPT_NAME })
    .first();
  await expect(row).toBeVisible({ timeout: 10_000 });

  const drawer = await openEntityPanel(page, row);
  await clickPanelAction(drawer, "changeHistory");
  const dialog = page.locator(".el-dialog:visible", {
    hasText: "变更历史"
  });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog.locator(".el-dialog__headerbtn").click();
  await expect(dialog).not.toBeVisible();
});
