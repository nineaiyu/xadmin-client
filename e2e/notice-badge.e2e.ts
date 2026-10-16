import { expect, test, type Page } from "@playwright/test";

import { ADMIN, APPROVER, BACKEND_URL, getAccessToken, login } from "./helpers";

/**
 * 铃铛角标与弹层内容的一致性：
 *
 * 角标 = 未读站内信 + 待我审批 + 进行中异步任务（三路相加），而弹层只列站内信。
 * 站内信为 0 时用户点开弹层只看到「暂无结果」，无从解释角标数字（实测踩中：
 * 角标 4 = 待审批 1 + 进行中任务 3，弹层一片空白）。因此底栏「任务中心」入口
 * 必须示出站内信之外的那部分数量，保证不变式成立：
 *
 *     角标数字 = 弹层页签数字合计 + 任务中心角标
 *
 * 数据准备走真实引擎：审批人（第二超管）发起、节点指派给 xadmin 的实例，
 * 使 xadmin 有待办；用例结束前通过该单，避免 PENDING 残留污染其他用例的角标断言。
 */

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function tokenFor(
  page: Page,
  creds: { username: string; password: string }
) {
  const browser = page.context().browser();
  if (!browser) throw new Error("无法获取浏览器实例");
  const context = await browser.newContext({ locale: "zh-CN" });
  const temp = await context.newPage();
  try {
    await login(temp, creds);
    return await getAccessToken(temp);
  } finally {
    await context.close();
  }
}

/** 建「单节点」流程（审批人 = xadmin），返回流程主键 */
async function createFlowForAdmin(
  page: Page,
  token: string,
  suffix: string
): Promise<string> {
  const res = await page.request.post(
    `${BACKEND_URL}/api/approval/approval-flows`,
    {
      headers: auth(token),
      data: {
        name: `E2E铃铛流程-${suffix}`,
        code: `e2e_badge_${suffix}`,
        is_active: true,
        form_schema: [{ key: "amount", label: "金额", type: "number" }],
        nodes: [
          {
            name: "初审",
            order: 1,
            approve_type: "OR",
            assignee_type: "user",
            assignee_value: ADMIN.username
          }
        ]
      }
    }
  );
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).data.pk as string;
}

/** 发起申请（申请人 ≠ 审批人，避免自审排除），返回实例主键 */
async function createInstance(
  page: Page,
  token: string,
  flowPk: string,
  title: string
): Promise<string> {
  const res = await page.request.post(
    `${BACKEND_URL}/api/approval/approval-instances`,
    {
      headers: auth(token),
      data: { flow: flowPk, title, form_data: { amount: 100 } }
    }
  );
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).data.pk as string;
}

/** 清理：撤回实例（申请人本人可撤回）+ 删除流程，避免在途单污染其他用例的角标断言 */
async function cleanup(
  page: Page,
  applicantToken: string,
  adminToken: string,
  instancePk: string,
  flowPk: string
) {
  if (instancePk) {
    await page.request
      .post(
        `${BACKEND_URL}/api/approval/approval-instances/${instancePk}/cancel`,
        { headers: auth(applicantToken), data: {} }
      )
      .catch(() => undefined);
  }
  if (flowPk) {
    await page.request
      .delete(`${BACKEND_URL}/api/approval/approval-flows/${flowPk}`, {
        headers: auth(adminToken)
      })
      .catch(() => undefined);
  }
}

/** 顶栏角标数字（0 表示无角标） */
async function readBadgeCount(page: Page): Promise<number> {
  const badge = page.locator(".dropdown-badge .el-badge__content").first();
  if ((await badge.count()) === 0) return 0;
  const matched = /(\d+)/.exec((await badge.innerText()) ?? "");
  return matched ? Number(matched[1]) : 0;
}

/** 弹层页签文字里的计数合计（形如「消息通知(2)」） */
async function readTabTotal(page: Page): Promise<number> {
  const tabs = page.locator(".dropdown-tabs .el-tabs__item");
  const total = await tabs.count();
  let sum = 0;
  for (let index = 0; index < total; index += 1) {
    const matched = /\((\d+)\)/.exec((await tabs.nth(index).innerText()) ?? "");
    if (matched) sum += Number(matched[1]);
  }
  return sum;
}

/** 底栏「任务中心」旁的角标数字（= 站内信之外的角标部分） */
async function readTaskBadge(page: Page): Promise<number> {
  const badge = page
    .locator('[data-testid="notice-task-badge"] .el-badge__content')
    .first();
  if ((await badge.count()) === 0) return 0;
  const matched = /(\d+)/.exec((await badge.innerText()) ?? "");
  return matched ? Number(matched[1]) : 0;
}

test("角标数字可在弹层内完整解释（站内信之外由任务中心入口示数）", async ({
  page
}) => {
  const adminToken = await tokenFor(page, ADMIN);
  const approverToken = await tokenFor(page, APPROVER);
  const suffix = Math.random().toString(36).slice(2, 8);
  let flowPk = "";
  let instancePk = "";

  try {
    flowPk = await createFlowForAdmin(page, adminToken, suffix);
    instancePk = await createInstance(
      page,
      approverToken,
      flowPk,
      `E2E铃铛待办-${suffix}`
    );

    await login(page, ADMIN);
    // 打开弹层即触发三路计数同步刷新（handleCommand → 站内信 + 待审批 + 进行中）
    await page.locator("#header-notice").click();
    await expect(page.locator(".dropdown-tabs")).toBeVisible({
      timeout: 15_000
    });

    // 不变式：角标 = 页签合计（站内信）+ 任务中心角标（其余两路）
    await expect
      .poll(
        async () =>
          (await readBadgeCount(page)) -
          ((await readTabTotal(page)) + (await readTaskBadge(page))),
        { timeout: 20_000 }
      )
      .toBe(0);

    // 本次造出的待办必须体现在任务中心入口上，否则该示数形同虚设
    expect(await readTaskBadge(page)).toBeGreaterThan(0);
  } finally {
    await cleanup(page, approverToken, adminToken, instancePk, flowPk);
  }
});
