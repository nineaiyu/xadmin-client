import { expect, test, type Locator, type Page } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 菜单管理页（重构后）：全宽菜单树 + 抽屉新增/编辑 + 右键菜单 + 批量启停 + 权限码预览。
 *
 * 用例纪律：双浏览器共享同一库，创建的节点名带时间戳且流程结束即删除，
 * 避免残留污染视觉基线（core-system-menu-*）与后续跑批的树结构。
 */

const PREFIX = "E2E菜单";

const uniqueName = (label: string) => `${PREFIX}${label}${Date.now()}`;

/** 行定位：以菜单标题文本收敛到单个 .menu-row（页面上同名行不存在于其他形态） */
const row = (page: Page, name: string): Locator =>
  page.locator(".menu-row", { hasText: name }).first();

async function openPage(page: Page) {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/menu/index");
  await expect(page.locator(".el-tree").first()).toBeVisible({
    timeout: 15_000
  });
  await expect(page.getByText("系统管理").first()).toBeVisible({
    timeout: 15_000
  });
}

/** 新增顶级目录：走工具栏「新增」→ 抽屉填写 → 保存后树内定位新节点 */
async function createMenu(page: Page, name: string) {
  await page.getByRole("button", { name: "新增", exact: true }).first().click();
  const drawer = page.locator(".el-drawer:visible").first();
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  await drawer.getByPlaceholder("请输入菜单标题").fill(name);
  await drawer.getByPlaceholder("组件名称").fill(name);
  await drawer.getByPlaceholder("请输入路由地址").fill(`/${name}`);
  await drawer.getByRole("button", { name: "保存" }).click();
  await expect(drawer).toBeHidden({ timeout: 15_000 });
  await expect(row(page, name)).toBeVisible({ timeout: 15_000 });
}

/** 行内「更多」下拉（el-dropdown 会保留隐藏副本，断言限定可见菜单） */
async function openRowMenu(page: Page, name: string) {
  const target = row(page, name);
  await target.hover();
  await target.getByRole("button", { name: "更多" }).click();
  const menu = page.locator(".el-dropdown-menu:visible").last();
  await expect(menu).toBeVisible({ timeout: 10_000 });
  return menu;
}

/** 删除并确认影响面弹窗 */
async function removeMenu(page: Page, name: string) {
  const menu = await openRowMenu(page, name);
  await menu.getByRole("menuitem", { name: "删除" }).click();
  const box = page.locator(".el-message-box:visible").first();
  await expect(box).toBeVisible({ timeout: 10_000 });
  await box.getByRole("button", { name: "删除" }).click();
  await expect(row(page, name)).toHaveCount(0, { timeout: 15_000 });
}

test("菜单管理：新增（抽屉）→ 编辑改名 → 删除（含影响面确认）", async ({
  page
}) => {
  await openPage(page);
  const name = uniqueName("A");
  await createMenu(page, name);

  // 点行（标题）打开编辑抽屉：改名后保存，树内就地更新
  await row(page, name).locator(".menu-row__title").click();
  const drawer = page.locator(".el-drawer:visible").first();
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  const renamed = `${name}改`;
  await drawer.getByPlaceholder("请输入菜单标题").fill(renamed);
  await drawer.getByRole("button", { name: "保存" }).click();
  await expect(drawer).toBeHidden({ timeout: 15_000 });
  await expect(row(page, renamed)).toBeVisible({ timeout: 15_000 });

  await removeMenu(page, renamed);
});

test("菜单管理：右键排序、批量停用与行内启停", async ({ page }) => {
  await openPage(page);
  const name = uniqueName("B");
  await createMenu(page, name);

  // 右键菜单（与行内「更多」同一份动作清单）→ 同层下移
  // 新建节点 rank 最小、位于同级首位，故取「下移一位」（上移在边界是空操作）
  await row(page, name).click({ button: "right" });
  const context = page.locator(".menu-context");
  await expect(context).toBeVisible({ timeout: 10_000 });
  await context.getByRole("menuitem", { name: "下移一位" }).click();
  await expect(page.getByText("排序已保存").first()).toBeVisible({
    timeout: 10_000
  });

  // 多选模式：勾选节点 → 批量停用（含后代）
  await page.locator(".menu-toolbar__more").click();
  await page
    .locator(".el-dropdown-menu:visible")
    .getByRole("menuitem", { name: "多选模式" })
    .click();
  const batchbar = page.locator(".menu-batchbar");
  await expect(batchbar).toBeVisible({ timeout: 10_000 });

  await page
    .locator(".el-tree-node__content", { hasText: name })
    .locator(".el-checkbox")
    .first()
    .click();
  await expect(batchbar).toContainText("已选 1 项");
  await batchbar.getByRole("button", { name: "批量停用" }).click();
  const box = page.locator(".el-message-box:visible").first();
  await expect(box).toBeVisible({ timeout: 10_000 });
  await box.getByRole("button", { name: "确定" }).click();
  await expect(row(page, name)).toHaveClass(/is-inactive/, { timeout: 15_000 });

  // 行内启停：停用行再启用
  await row(page, name).hover();
  await row(page, name).locator(".el-switch").click();
  await expect(row(page, name)).not.toHaveClass(/is-inactive/, {
    timeout: 15_000
  });

  await batchbar.getByRole("button", { name: "退出多选" }).click();
  await removeMenu(page, name);
});

test("菜单管理：搜索命中深层节点（自动展开定位）", async ({ page }) => {
  await openPage(page);
  const search = page.getByPlaceholder("搜索菜单名称 / 路由 / 权限码");
  await search.fill("api/system/user$");

  // 三级权限点：旧实现只隐藏不展开，命中项藏在折叠里不可见
  await expect(
    page.locator(".menu-row", { hasText: "api/system/user$" }).first()
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/命中 \d+/).first()).toBeVisible();

  await search.fill("");
  await expect(page.locator(".el-tree").first()).toBeVisible();
});

test("菜单管理：生成权限码为干跑预览（可关闭且不落库）", async ({ page }) => {
  await openPage(page);
  const name = uniqueName("C");
  await createMenu(page, name);

  // 选中节点：点标题打开编辑抽屉（未修改，生成权限码时会先收起抽屉再开弹窗）
  await row(page, name).locator(".menu-row__title").click();
  await expect(page.locator(".el-drawer:visible").first()).toBeVisible({
    timeout: 15_000
  });

  await page.getByRole("button", { name: "自动批量添加权限" }).click();
  const dialog = page.locator(".el-dialog:visible").first();
  await expect(dialog).toBeVisible({ timeout: 15_000 });

  // 选择后端视图 → dry_run 预览表出现「新建/覆盖」明细
  await dialog.locator(".el-select").first().click();
  await page
    .locator(".el-select-dropdown:visible .el-select-dropdown__item")
    .first()
    .click();
  await page.keyboard.press("Escape");
  await expect(dialog.locator(".el-table__row").first()).toBeVisible({
    timeout: 15_000
  });
  await expect(dialog).toContainText("将新建");

  // 取消：不落库（真正的写入由后端 permissions 接口承担，前端只发 dry_run）
  await dialog.getByRole("button", { name: "取消" }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });

  await removeMenu(page, name);
});
