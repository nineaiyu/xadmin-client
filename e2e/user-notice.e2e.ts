import { expect, test, type Page } from "@playwright/test";

import { login, PLAIN_USER } from "./helpers";

/**
 * 我的通知（个人中心 → 我的通知）+ 顶栏铃铛：
 * 1. 种子两条未读通知（xadmin-server/scripts/e2e_seed.py::seed_user_notice_scene，
 *    标题固定、e2e_user 已授权页面与其权限点）；
 * 2. 列表展示标题，「查看」弹层打开后该行自动标记已读（showDialog 内 batchRead）；
 * 3. 「全部已读」后未读清零（按钮随 unreadCount 隐藏、顶栏角标归零）。
 *
 * 双浏览器共享同一后端库：未读状态不作跨用例强绑定，断言保持幂等——
 * 详情打开必然落到「已读」；全读操作按按钮存在性条件触发。
 */

const NOTICE_TITLE = "E2E通知：系统升级预告";

async function openNoticePage(page: Page) {
  await page.goto("/#/user/notice/index");
  await expect(
    page.getByRole("row", { name: new RegExp(NOTICE_TITLE) }).first()
  ).toBeVisible({
    timeout: 15_000
  });
}

test.describe("我的通知", () => {
  test("列表展示通知，查看弹层后自动标记已读", async ({ page }) => {
    await login(page, PLAIN_USER);
    await openNoticePage(page);

    const row = page
      .getByRole("row", { name: new RegExp(NOTICE_TITLE) })
      .first();
    await row.getByRole("button", { name: "查看", exact: true }).click();

    const dialog = page.locator(".el-dialog").filter({ hasText: NOTICE_TITLE });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("E2E 用例使用的未读通知")).toBeVisible();
    await dialog.locator(".el-dialog__headerbtn").click();

    // 打开详情即已读（无论此前是否未读，重复执行仍成立）
    await expect(row.getByText("已读", { exact: true })).toBeVisible();
  });

  test("全部已读后未读清零、顶栏角标归零", async ({ page }) => {
    await login(page, PLAIN_USER);
    await openNoticePage(page);

    const allRead = page.getByRole("button", { name: "全部已读" });
    if (
      await allRead
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await allRead.first().click();
    }
    await expect(page.getByRole("button", { name: "全部已读" })).toHaveCount(0);

    // 角标 = 未读站内信 + 待办审批 + 进行中任务；e2e_user 无审批/任务权限，只剩站内信
    await expect(
      page.locator(".dropdown-badge .el-badge__content")
    ).toBeHidden();
  });
});
