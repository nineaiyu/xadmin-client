import { expect, test, type Page } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 任务中心聚合抽屉（铃铛入口）：提交一次异步导出 → 抽屉「最近导出」出现该记录
 * → 行内下载复用既有链路。后端不建聚合表，四段各自读既有列表接口。
 *
 * E2E 环境（CELERY_TASK_ALWAYS_EAGER）下任务同步执行，记录提交后即为成功态，
 * 因此这里断言「最近可见 + 可下载」，进行中态由后端单测覆盖。
 */

async function openUserManagement(page: Page) {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/user/index");
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });
}

async function openTaskCenter(page: Page) {
  await page.locator(".dropdown-badge").first().click();
  // el-link 无 href 时渲染成 span（无 link 角色），按文本定位
  await page.getByText("任务中心", { exact: true }).first().click();
  const drawer = page.locator(".el-drawer", { hasText: "任务中心" }).first();
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  return drawer;
}

test("任务中心抽屉：异步导出后「最近导出」可见且可下载", async ({ page }) => {
  await openUserManagement(page);

  // 工具栏第 2 个按钮 = 导出（其后为导入）
  await page
    .locator("div.flex.mr-4")
    .first()
    .locator("button.el-button")
    .nth(1)
    .click();
  const dialog = page.locator(".el-dialog", { hasText: "导出" }).first();
  await expect(dialog).toBeVisible();
  await dialog.locator(".el-switch").first().click();
  await dialog
    .getByRole("button", { name: /保存|确定/ })
    .first()
    .click();
  await expect(dialog).not.toBeVisible({ timeout: 30_000 });

  const drawer = await openTaskCenter(page);
  await expect(drawer).toContainText("最近导出");

  const row = drawer.locator(".record-row", { hasText: "userinfo_" }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row).toContainText("成功");

  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  await row.getByRole("button", { name: "下载" }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/\.xlsx$/);
});

test("任务中心抽屉：四段信息架构齐全且「查看全部」跳转既有页面", async ({
  page
}) => {
  await login(page);
  const drawer = await openTaskCenter(page);
  for (const section of ["审批待办", "进行中任务", "最近导出", "最近导入"]) {
    await expect(drawer).toContainText(section);
  }

  // 「查看全部」跳转既有页面（四段中第一个是审批待办）
  await drawer.getByText("查看全部").first().click();
  await expect(page.locator(".el-drawer")).toHaveCount(0);
  await expect(page).toHaveURL(/#\/system\/approval\/index/);
});
