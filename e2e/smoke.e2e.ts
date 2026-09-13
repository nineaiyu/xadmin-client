import { expect, test } from "@playwright/test";

import {
  BACKEND_URL,
  getAccessToken,
  login,
  logout,
  openList,
  openMenu,
  openMenuPath
} from "./helpers";

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
  await openList(page, "/system/user/index");
  const table = page.locator(".el-table").first();
  await expect(table).toBeVisible();
  // 只断言「列表已加载出数据行 + 分页渲染」，不绑定具体账号：默认
  // ordering=-created_time + pageSize=15，全量跑时早期种子账号会被挤出第一页
  // （详见 helpers.openListWithQuery 注释）
  await expect(table.locator(".el-table__row").first()).toBeVisible();
  await expect(page.locator(".el-pagination").first()).toBeVisible();
});

test("角色权限：列表与搜索区渲染，新增弹层渲染授权树 @smoke", async ({
  page
}) => {
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

  // 新增弹层的授权树来自 search-columns 的 menu 列：首开走 with_meta=1 内联
  // 元数据，列缺失时弹层会退化成空白表单（控制台 fieldProps 报错），这里锚定
  await page.getByRole("button", { name: "新增" }).first().click();
  const dialog = page.locator(".el-dialog:visible").first();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog.locator(".el-tree").first()).toBeVisible({
    timeout: 15_000
  });
  await expect(dialog.locator(".el-tree-node").first()).toBeVisible({
    timeout: 15_000
  });
  await dialog.locator(".el-dialog__headerbtn").first().click();
  await expect(dialog).not.toBeVisible({ timeout: 15_000 });
});

test("角色权限：新增保存 → 列表可见 → 删除 @smoke", async ({ page }) => {
  const roleName = `e2e新增角色_${Date.now()}`;
  await login(page);
  await openMenuPath(page, ["系统管理", "权限管理"], "/system/role/index");
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });

  // 新增（名称 + 编码必填）；不勾选授权也要能保存（fields 需有默认值）
  await page.getByRole("button", { name: "新增" }).first().click();
  const dialog = page.locator(".el-dialog:visible").first();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog
    .locator(".el-form-item:has-text('角色名称') input")
    .first()
    .fill(roleName);
  await dialog
    .locator(".el-form-item:has-text('角色标识') input")
    .first()
    .fill(`e2e_add_${Date.now()}`);
  await dialog
    .getByRole("button", { name: /保存|确定/ })
    .first()
    .click();
  await expect(dialog).not.toBeVisible({ timeout: 15_000 });

  // 列表出现（列表固定 ordering=-created_time，新角色在首屏）
  const row = page.locator(".el-table__row", { hasText: roleName }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });

  // 删除（操作列按钮 + Popconfirm 确认）
  await row.getByRole("button", { name: "删除" }).first().click();
  await page
    .locator(".el-popconfirm, .el-popper, .el-message-box")
    .getByRole("button", { name: "确定" })
    .first()
    .click();
  await expect(
    page.locator(".el-table__row", { hasText: roleName })
  ).toHaveCount(0, { timeout: 15_000 });
});

test("角色权限：编辑弹层回显授权树勾选 @smoke", async ({ page }) => {
  const roleName = `e2e编辑回显角色_${Date.now()}`;
  await login(page);

  // API 造一个带授权的角色：授权根级菜单（树默认折叠，根节点也会渲染，便于断言勾选回显）
  const token = await getAccessToken(page);
  const headers = {
    Authorization: `Bearer ${token}`,
    "User-Agent": "e2e-test"
  };
  const menusRes = await page.request.get(
    `${BACKEND_URL}/api/system/menu?page=1&size=1000`,
    { headers }
  );
  const menus = ((await menusRes.json())?.data?.results ?? []) as Array<{
    pk: string;
    parent?: string;
  }>;
  const rootMenu = menus.find(menu => !menu.parent);
  if (!rootMenu) {
    throw new Error("种子菜单缺少根级节点");
  }
  const created = await page.request.post(`${BACKEND_URL}/api/system/role`, {
    headers,
    data: {
      name: roleName,
      code: `e2e_edit_${Date.now()}`,
      fields: {},
      menu: [rootMenu.pk]
    }
  });
  expect(created.ok()).toBeTruthy();
  const rolePk = (await created.json())?.data?.pk;

  try {
    await openMenuPath(page, ["系统管理", "权限管理"], "/system/role/index");
    const row = page.locator(".el-table__row", { hasText: roleName }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole("button", { name: "编辑" }).first().click();

    const dialog = page.locator(".el-dialog:visible").first();
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.locator(".el-tree").first()).toBeVisible({
      timeout: 15_000
    });
    // 回显：详情里的授权（field 为 {menuPk: [fieldPk]} 字典）必须落到树勾选态；
    // 修复前字典未归一化 → form.vue push 抛错、initData 不执行 → 勾选全丢
    await expect(dialog.locator(".el-checkbox.is-checked").first()).toBeVisible(
      {
        timeout: 15_000
      }
    );
  } finally {
    await page.request.delete(`${BACKEND_URL}/api/system/role/${rolePk}`, {
      headers
    });
  }
});

test("登出后回到登录页 @smoke", async ({ page }) => {
  await login(page);
  await logout(page);
});
