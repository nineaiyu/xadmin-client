import { expect, test, type Page } from "@playwright/test";

import { FRONT_URL, login, logout, PLAIN_USER } from "./helpers";

/**
 * 我的通知（个人中心 → 我的通知）+ 顶栏铃铛：
 * 1. 用例以超管经 API 自建一条「最新」定向通知（唯一标题，USER 类型发给
 *    e2e_user——系统公告 NOTICE 类型禁止 API 创建，NoticeMessageSerializer
 *    自 2024-09 起的既有产品语义，公告由系统产生而非人工新建）。双浏览器
 *    共享同一后端库，跑批期间通知持续累积（列表按时间倒序），固定标题的
 *    种子通知会被挤出第一页（webkit 阶段实测踩中）——唯一新标题保证列表
 *    首屏可见；
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

/** 超管自建唯一标题定向通知（USER 类型发给 e2e_user），返回标题供列表断言定位 */
async function seedFreshNotice(page: Page): Promise<string> {
  const title = `E2E通知：升级预告-${Date.now()}`;
  // 收件人取 pk：种子助手以超管身份调用，e2e_user 由 scripts/e2e_seed.py 种入
  const list = await jsonRequest(
    page,
    "get",
    `/api/system/user?username=${PLAIN_USER.username}`
  );
  // 列表响应形态：data = { total, results }（common/core/pagination.py PageNumber）
  const rows = (Array.isArray(list.data) ? list.data : list.data?.results) as
    { pk?: number; id?: number; username: string }[] | undefined;
  const target = rows?.find(row => row.username === PLAIN_USER.username);
  expect(target, "e2e_user 必须已由 scripts/e2e_seed.py 种入").toBeTruthy();
  const created = await jsonRequest(
    page,
    "post",
    "/api/notifications/notice-messages",
    {
      title,
      level: "primary",
      // USER 定向通知：NOTICE(1) 为系统公告，API 创建被序列化器拒绝（400）
      notice_type: 2,
      notice_user: [target!.pk ?? target!.id],
      publish: true,
      files: [],
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
