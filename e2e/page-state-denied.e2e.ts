import { expect, test } from "@playwright/test";

import { DENIED_USER, login } from "./helpers";

/**
 * 页面级权限负向（权限渲染域）：账号有列表页菜单、但没有任何接口权限点
 * （缺 list 权限码）时，RePlusPage 应渲染框架拒绝态——
 * `[data-testid="plus-page-state"]` + 无权限文案，而不是空白页或 0 行表格。
 *
 * 种子见 xadmin-server/scripts/e2e_seed.py：e2e_denied 仅授予「岗位管理」
 * 页面与父目录菜单。目标页必须是 RePlusPage 薄壳——用户管理页对缺 list
 * 有自有 el-alert 兜底（index.vue 的 v-else 分支），走不到框架 PageState
 * 分支，故选岗位管理页承载本守护。与 auth.e2e.ts 的「直捣未授权路由」
 * 用例互补：那边路由不注册，这边路由可达但页面自身拒绝。
 */
test("无 list 权限：列表页渲染拒绝态而非空表格", async ({ page }) => {
  await login(page, DENIED_USER);
  // 路由已注册（页面菜单已授权）：直达应渲染页面本体，而非 404
  await page.goto("/#/system/post/index");

  const denied = page.locator('[data-testid="plus-page-state"]');
  await expect(denied).toBeVisible({ timeout: 15_000 });
  await expect(denied).toContainText("没有该页面的查看权限");

  // 拒绝态下搜索区与表格整体不渲染（frameworkState !== ready 分支），
  // 与「表格就绪但 0 行」的数据权限形态（permissions.e2e.ts）形成区分
  await expect(page.locator(".el-table")).toHaveCount(0);
  await expect(page.locator(".re-plus-search-card")).toHaveCount(0);
});
