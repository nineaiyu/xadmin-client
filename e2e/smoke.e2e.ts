import { expect, test } from "@playwright/test";

import { login, logout, openMenu } from "./helpers";

/**
 * xadmin E2E 冒烟：登录 → 菜单 → 部门 CRUD → 用户列表 → 登出
 * 后端由 playwright.config.ts 的 webServer 自动拉起（tests.settings_e2e，
 * sqlite + 关验证码/加密），凭据见 e2e/helpers.ts（种子：scripts/e2e_seed.py）
 *
 * 全部用例带 `@smoke` 标签：`E2E_SMOKE=1`（pnpm test:e2e:smoke）只跑本文件的
 * 用例 + chromium，供 dev push 快速反馈；全量档（PR/main/夜间）跑全部用例 × 双浏览器。
 */

test("登录成功并渲染侧边菜单 @smoke", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("menuitem", { name: "系统管理" })).toBeVisible();
  // 子菜单需展开后渲染
  await openMenu(page, "系统管理", "部门管理");
  await expect(page.locator(".el-table")).toBeVisible();
});

test("部门管理：新增 → 列表可见 → 删除 → 列表消失 @smoke", async ({ page }) => {
  const deptName = `E2E测试部门-${Date.now()}`;
  await login(page);
  await openMenu(page, "系统管理", "部门管理");

  const table = page.locator(".el-table");
  await expect(table).toBeVisible();

  // 新增（部门名称 + 部门标识均为必填）
  await page.getByRole("button", { name: "新增" }).first().click();
  const dialog = page.locator(".el-dialog");
  await expect(dialog).toBeVisible();
  const nameInput = dialog.locator(".el-form-item:has-text('部门名称') input");
  await nameInput.fill(deptName);
  const codeInput = dialog.locator(".el-form-item:has-text('部门标识') input");
  await codeInput.fill(`e2e_${Date.now()}`);
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog).not.toBeVisible();

  // 列表出现
  await expect(page.getByText(deptName).first()).toBeVisible();

  // 删除（操作列按钮 + Popconfirm 确认）
  const row = page.getByRole("row", { name: new RegExp(deptName) });
  await row.getByRole("button", { name: "删除" }).first().click();
  const confirmBtn = page
    .locator(".el-popconfirm, .el-popper")
    .getByRole("button", { name: "确定" })
    .first();
  await confirmBtn.click();

  // 列表消失
  await expect(page.getByText(deptName)).toHaveCount(0);
});

test("用户管理：列表加载数据 @smoke", async ({ page }) => {
  await login(page);
  await openMenu(page, "系统管理", "用户管理");
  const table = page.locator(".el-table");
  await expect(table).toBeVisible();
  await expect(table.getByText("xadmin").first()).toBeVisible();
});

test("角色权限：列表与搜索区渲染 @smoke", async ({ page }) => {
  await login(page);
  // 角色权限位于 系统管理 → 权限管理 二级目录下
  await page.getByRole("menuitem", { name: "系统管理" }).first().click();
  const perm = page.getByRole("menuitem", { name: "权限管理" }).first();
  await perm.waitFor({ state: "visible" });
  await perm.click();
  const roleItem = page.getByRole("menuitem", { name: "角色权限" }).first();
  await roleItem.waitFor({ state: "visible" });
  await roleItem.click();
  const table = page.locator(".el-table");
  await expect(table).toBeVisible();
  // RePlusPage 搜索区渲染器链路（搜索项多时默认折叠，展开后重置按钮才显示）
  await expect(page.getByRole("button", { name: "搜索" })).toBeVisible();
  const expandBtn = page.getByRole("button", { name: /展开/ });
  if (await expandBtn.isVisible().catch(() => false)) {
    await expandBtn.click();
  }
  await expect(
    page.locator("form").getByRole("button", { name: "重置" })
  ).toBeVisible();
});

test("登出后回到登录页 @smoke", async ({ page }) => {
  await login(page);
  await logout(page);
});
