import { expect, test } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * U-3 表头排序 + F-13 高级筛选（同一页验证，减少登录/导航重复）。
 *
 * 口径：
 * - 表头排序：仅元数据下发 sortable 的列可点，点击把 `ordering=field` / `-field`
 *   写入列表请求（服务端排序），再点一次切降序；
 * - 高级筛选：受控 lookup 条件行 → `field__lookup=value` 请求参数；
 *   用户视图集已 opt-in（controlled_lookup），字段来自列元数据。
 */

/** 收集用户列表请求（含首开的 with_meta），供参数断言 */
function collectUserRequests(page: import("@playwright/test").Page) {
  const urls: string[] = [];
  page.on("request", request => {
    const url = request.url();
    if (
      url.includes("/api/system/user?") ||
      url.includes("/api/system/user/?")
    ) {
      urls.push(url);
    }
  });
  return urls;
}

test("表头排序：点击可排序列把 ordering 写入请求，再点切降序", async ({
  page
}) => {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/user/index");
  // 等待表格渲染（工具栏按钮为加载锚点，RePlusPage 表格容器无 testid）
  await expect(
    page.getByRole("button", { name: "新增" }).first()
  ).toBeVisible();

  const requests = collectUserRequests(page);
  // 元数据声明 ordering_fields 的列渲染排序 caret（date_joined 的展示名是「注册时间」）
  const headerCell = page
    .locator(".el-table__header th")
    .filter({ hasText: "注册时间" })
    .first();
  await expect(headerCell.locator(".caret-wrapper")).toBeVisible();

  // 点升序 caret → ordering=date_joined
  await headerCell.locator(".sort-caret.ascending").click();
  await expect
    .poll(() => requests.some(url => url.includes("ordering=date_joined")))
    .toBeTruthy();

  // 点降序 caret → ordering=-date_joined
  await headerCell.locator(".sort-caret.descending").click();
  await expect
    .poll(() => requests.some(url => url.includes("ordering=-date_joined")))
    .toBeTruthy();
});

test("高级筛选：受控 lookup 条件写入请求并过滤列表", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/user/index");
  await expect(
    page.getByRole("button", { name: "新增" }).first()
  ).toBeVisible();

  const requests = collectUserRequests(page);
  await page.getByRole("button", { name: "高级筛选" }).first().click();

  const dialog = page.locator(".el-dialog:visible").first();
  await expect(dialog).toBeVisible();

  // 字段：用户名（值用种子超管 xadmin，保证结果稳定）
  await dialog.locator('[data-testid="af-field"]').first().click();
  await page
    .locator(".el-select-dropdown:visible .el-select-dropdown__item", {
      hasText: "用户名"
    })
    .first()
    .click();
  // lookup 默认「包含」，仅填值
  await dialog.locator('[data-testid="af-value"] input').first().fill("xadmin");
  // ReDialog 确认按钮文案为「保存」
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog).toBeHidden();

  await expect
    .poll(() => requests.some(url => /username__icontains=xadmin/.test(url)))
    .toBeTruthy();

  // 应用后列表只剩命中行
  await expect
    .poll(async () =>
      page.locator(".el-table__body-wrapper tbody tr").first().innerText()
    )
    .toContain("xadmin");

  // 再打开弹窗：已生效条件回显（回显能力）
  await page.getByRole("button", { name: "高级筛选" }).first().click();
  const dialogAgain = page.locator(".el-dialog:visible").first();
  await expect(
    dialogAgain.locator('[data-testid="af-value"] input').first()
  ).toHaveValue("xadmin");
  await dialogAgain.getByRole("button", { name: "取消" }).click();
  await expect(dialogAgain).toBeHidden();
});
