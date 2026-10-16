import { expect, test } from "@playwright/test";

import { login } from "./helpers";

/**
 * 二开样板页守护：`generate_crud` 产出的前端页面（src/views/demo/book）能真实渲染。
 *
 * 菜单与权限点由 e2e_seed 现场用生成器产出并入库（种子不落仓库，与二开者照抄的
 * 产物同源）：生成器改了页面/菜单结构而样板没跟上时，本用例立即失败。
 * 断言保持 smoke 级别——页面可打开、搜索区与表格渲染、列元数据装配到位；
 * CRUD 行为由生成器单测（test_generate_crud）与各业务页 E2E 覆盖，不在此重复。
 */
test("二开样板页：demo/book 列表渲染", async ({ page }) => {
  await login(page);
  // 整页 goto（SPA hash 路由直跳需要整页加载，避免命中上一页残留 DOM）
  await page.goto("/#/default/demo/book/index");

  // 搜索卡片与列表区就位（样板页 = RePlusPage 薄壳，此二者即页面骨架）
  await expect(page.locator(".re-plus-search-card")).toBeVisible({
    timeout: 15_000
  });
  await expect(
    page.locator(".el-table, .pure-table, .el-empty").first()
  ).toBeVisible({
    timeout: 15_000
  });
  // 列元数据契约：/api/demo/book 的 search-columns 正常下发（表头非空 = 列装配完成）
  await expect(page.locator(".el-table th").first()).toBeVisible({
    timeout: 15_000
  });
});
