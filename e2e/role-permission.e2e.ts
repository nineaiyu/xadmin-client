import { expect, test, type Locator, type Page } from "@playwright/test";

import { FRONT_URL, getAccessToken, login, openMenuPath } from "./helpers";

/**
 * 角色菜单权限配置树（新增/编辑角色弹窗内）。
 *
 * 覆盖：树渲染与勾选统计、搜索过滤（标题/权限码/路由）、全选/反选、三态标识
 * （已选/部分选中/未选）、父子联动勾选，以及「勾选 → 保存 → 重新打开回显」闭环。
 *
 * 只读用例只打开编辑弹窗、不保存；闭环用例用 API 建临时角色、用后删除，
 * 保证双浏览器共享库下的幂等（不依赖前序用例状态，也不留下脏数据）。
 */

const TREE = '[data-testid="permission-tree"]';
const TOTAL = '[data-testid="permission-total"]';
const MATCHED = '[data-testid="permission-matched"]';
const NODE_STATUS = '[data-testid="permission-node-status"]';
/** 编辑对象：种子角色「管理员」（权限最全，只读用例不改动其授权） */
const SEED_ROLE = "管理员";

async function openRolePage(page: Page) {
  // 角色管理是三级菜单：系统管理 → 权限管理 → 角色管理
  await openMenuPath(page, ["系统管理", "权限管理"], "/system/role/index");
  await expect(page.getByRole("button", { name: "新增" }).first()).toBeVisible({
    timeout: 15_000
  });
}

/** 打开指定角色的编辑弹窗（授权树可见后返回弹窗 locator） */
async function openEditDialog(page: Page, roleName: string) {
  const row = page
    .locator(".el-table__row")
    .filter({ hasText: roleName })
    .first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button", { name: "编辑", exact: true }).first().click();
  const dialog = page
    .locator(".el-dialog")
    .filter({ has: page.locator(TREE) })
    .first();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog.locator(TREE)).toBeVisible({ timeout: 15_000 });
  return dialog;
}

/**
 * 节点自身的内容行。
 *
 * 用 `.el-tree-node__content`（只含该节点自身文本，后代节点是独立 div）而非
 * `.el-tree-node`：后者会匹配到所有包含该文本的祖先节点。
 */
function nodeContent(dialog: Locator, title: string) {
  return dialog
    .locator(TREE)
    .locator(".el-tree-node__content")
    .filter({ hasText: title })
    .first();
}

/** 解析「已选 {checked} / {total} 项」统计文本 */
function readTotal(text: string): { checked: number; total: number } {
  const matched = /已选\s*(\d+)\s*\/\s*(\d+)/.exec(text);
  return {
    checked: Number(matched?.[1] ?? -1),
    total: Number(matched?.[2] ?? -1)
  };
}

test("授权树渲染与搜索过滤", async ({ page }) => {
  await login(page);
  await openRolePage(page);
  const dialog = await openEditDialog(page, SEED_ROLE);

  const tree = dialog.locator(TREE);
  await expect(dialog.locator(TOTAL)).toContainText(
    /已选\s*\d+\s*\/\s*\d+\s*项/
  );
  // 默认展开顶层，可见节点数应有可辨识规模
  const initialNodes = await tree.locator(".el-tree-node:visible").count();
  expect(initialNodes).toBeGreaterThan(5);

  // 搜索：命中计数出现，无关节点（聊天室）被隐藏（筛选生效）
  const unrelated = nodeContent(dialog, "聊天室");
  await expect(unrelated).toBeVisible();
  const search = dialog.getByPlaceholder("搜索菜单标题、权限码或路由");
  await search.fill("角色");
  await expect(dialog.locator(MATCHED)).toContainText(/匹配\s*\d+\s*项/);
  await expect(unrelated).toBeHidden();

  // 清空搜索：命中计数消失，被过滤的节点恢复显示
  await search.fill("");
  await expect(dialog.locator(MATCHED)).toHaveCount(0);
  await expect(unrelated).toBeVisible();
});

test("全选、反选与三态标识", async ({ page }) => {
  await login(page);
  await openRolePage(page);
  const dialog = await openEditDialog(page, SEED_ROLE);
  const total = dialog.locator(TOTAL);
  const firstStatus = dialog.locator(NODE_STATUS).first();

  // 清空 → 全部未选
  await dialog.getByRole("button", { name: "清空" }).click();
  await expect(total).toContainText("已选 0 /");
  await expect(firstStatus).toHaveText("未选");

  // 全选 → 已选数与总数一致，状态标识转为已选
  await dialog.getByRole("button", { name: "全选", exact: true }).click();
  const all = readTotal(await total.innerText());
  expect(all.total).toBeGreaterThan(5);
  expect(all.checked).toBe(all.total);
  await expect(firstStatus).toHaveText("已选");

  // 反选（全选态）→ 全部取消
  await dialog.getByRole("button", { name: "反选" }).click();
  await expect(total).toContainText("已选 0 /");
  await expect(firstStatus).toHaveText("未选");
});

test("父子联动：勾选目录联动其下菜单与权限点", async ({ page }) => {
  await login(page);
  await openRolePage(page);
  const dialog = await openEditDialog(page, SEED_ROLE);
  const tree = dialog.locator(TREE);

  await dialog.getByRole("button", { name: "清空" }).click();
  await expect(dialog.locator(TOTAL)).toContainText("已选 0 /");
  const content = nodeContent(dialog, "系统管理");
  await expect(content.locator(NODE_STATUS)).toHaveText("未选");

  const before = await tree.locator(".el-checkbox.is-checked").count();
  await content.locator(".el-checkbox").first().click();

  // 目录自身转为已选，其下可见节点被联动勾选
  await expect(content.locator(NODE_STATUS)).toHaveText("已选");
  await expect
    .poll(() => tree.locator(".el-checkbox.is-checked").count(), {
      timeout: 15_000
    })
    .toBeGreaterThan(before + 2);
  const stats = readTotal(await dialog.locator(TOTAL).innerText());
  expect(stats.checked).toBeGreaterThan(2);

  // 取消勾选后回到未选，且勾选数回落
  await content.locator(".el-checkbox").first().click();
  await expect(content.locator(NODE_STATUS)).toHaveText("未选");
  await expect
    .poll(() => tree.locator(".el-checkbox.is-checked").count(), {
      timeout: 15_000
    })
    .toBe(before);
});

test("勾选保存后重新打开正确回显", async ({ page }) => {
  await login(page);
  const suffix = `${Date.now()}`.slice(-7);
  const roleName = `E2E权限树${suffix}`;
  const roleCode = `e2e_perm_${suffix}`;
  const token = await getAccessToken(page);

  const created = await page.request.post(`${FRONT_URL}/api/system/role`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: roleName,
      code: roleCode,
      is_active: true,
      menu: [],
      fields: {}
    }
  });
  expect(created.ok()).toBeTruthy();
  const body = await created.json();
  const rolePk = body?.data?.pk ?? body?.pk;
  expect(rolePk).toBeTruthy();

  try {
    await openRolePage(page);
    const dialog = await openEditDialog(page, roleName);

    // 勾选「数据分析」目录（顶层目录，规模小便于断言）
    await dialog.getByRole("button", { name: "清空" }).click();
    await expect(dialog.locator(TOTAL)).toContainText("已选 0 /");
    const content = nodeContent(dialog, "数据分析");
    await content.locator(".el-checkbox").first().click();
    await expect(content.locator(NODE_STATUS)).toHaveText("已选");
    const saved = readTotal(await dialog.locator(TOTAL).innerText());
    expect(saved.checked).toBeGreaterThan(0);

    await dialog.getByRole("button", { name: "保存", exact: true }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });

    // 重新打开：勾选数量与目录状态被正确回显
    const reopened = await openEditDialog(page, roleName);
    await expect
      .poll(
        async () =>
          readTotal(await reopened.locator(TOTAL).innerText()).checked,
        { timeout: 15_000 }
      )
      .toBe(saved.checked);
    await expect(
      nodeContent(reopened, "数据分析").locator(NODE_STATUS)
    ).toHaveText("已选");
  } finally {
    await page.request.delete(`${FRONT_URL}/api/system/role/${rolePk}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
});
