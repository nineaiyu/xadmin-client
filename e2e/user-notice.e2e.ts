import { expect, test, type Page } from "@playwright/test";

import { FRONT_URL, login, logout, PLAIN_USER } from "./helpers";

/**
 * 我的通知（个人中心 → 我的通知）+ 顶栏铃铛：
 * 1. 用例以超管经 API 自建一条「最新」公告（唯一标题，NOTICE 类型全员可见，
 *    无需定向收件人）。双浏览器共享同一后端库，跑批期间系统消息持续累积
 *    （列表按时间倒序），固定标题的种子通知会被挤出第一页（webkit 阶段实测
 *    踩中）——唯一新标题保证列表首屏可见；
 * 2. 列表展示标题，「查看」弹层打开后该行自动标记已读（showDialog 内 batchRead）；
 * 3. 「全部已读」后未读清零（按钮随 unreadCount 隐藏、顶栏角标归零）。
 *
 * 断言保持幂等：详情打开必然落到「已读」；全读操作按按钮存在性条件触发。
 */

const NOTICE_BODY = "这是 E2E 用例使用的未读通知";

async function jsonRequest(
  page: Page,
  method: "get" | "post",
  path: string,
  data?: unknown
): Promise<{ code: number; data: Record<string, unknown> | null }> {
  const response = await page.request[method](`${FRONT_URL}${path}`, {
    data: data ?? {}
  });
  return (await response.json()) as {
    code: number;
    data: Record<string, unknown> | null;
  };
}

/** 超管自建唯一标题公告（publish 全员可见），返回标题供列表断言定位 */
async function seedFreshNotice(page: Page): Promise<string> {
  const title = `E2E通知：升级预告-${Date.now()}`;
  const created = await jsonRequest(
    page,
    "post",
    "/api/notifications/notice-messages",
    {
      title,
      level: "primary",
      notice_type: 1,
      publish: true,
      message: `<p>${title}——${NOTICE_BODY}，可在「我的通知」中查看。</p>`
    }
  );
  expect(created.code).toBe(1000);
  return title;
}

async function openNoticePage(page: Page, title: string) {
  await page.goto("/#/user/notice/index");
  await expect(
    page.getByRole("row", { name: new RegExp(title) }).first()
  ).toBeVisible({
    timeout: 15_000
  });
}

test.describe("我的通知", () => {
  test("列表展示通知，查看弹层后自动标记已读", async ({ page }) => {
    await login(page);
    const title = await seedFreshNotice(page);
    await logout(page);
    await login(page, PLAIN_USER);
    await openNoticePage(page, title);

    const row = page.getByRole("row", { name: new RegExp(title) }).first();
    await row.getByRole("button", { name: "查看", exact: true }).click();

    const dialog = page.locator(".el-dialog").filter({ hasText: title });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(NOTICE_BODY)).toBeVisible();
    await dialog.locator(".el-dialog__headerbtn").click();

    // 打开详情即已读（无论此前是否未读，重复执行仍成立）
    await expect(row.getByText("已读", { exact: true })).toBeVisible();
  });

  test("全部已读后未读清零、顶栏角标归零", async ({ page }) => {
    await login(page);
    const title = await seedFreshNotice(page);
    await logout(page);
    await login(page, PLAIN_USER);
    await openNoticePage(page, title);

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
