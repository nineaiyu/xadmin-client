import { expect, test, type Page } from "@playwright/test";

import {
  APPROVER,
  BACKEND_URL,
  FRONT_URL,
  getAccessToken,
  login,
  openMenuPath,
  PLAIN_USER
} from "./helpers";

/**
 * 审批转交 + 管理视角（全部在途）E2E：
 * 1）转交链路：审批人把待办转给他人 → 原待办消失（列表）→ 详情轨迹留痕
 *    （原任务作废注明转交对象 + 新任务带「由 X 代理」来源标注）；
 * 2）管理视角：超管在「全部在途」页签看到审批中的申请（按 ongoing 权限点显示）。
 *
 * 流程定义与发起经 API 预置，业务动作走真实 UI。
 */

type NodePayload = {
  name: string;
  order: number;
  approve_type?: string;
  assignee_type?: string;
  assignee_value?: string;
};

async function createFlow(
  page: Page,
  token: string,
  code: string,
  nodes: NodePayload[]
) {
  const resp = await page.request.post(
    `${BACKEND_URL}/api/system/approval-flows`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `E2E流程-${code}`, code, form_schema: [], nodes }
    }
  );
  expect(resp.ok(), await resp.text()).toBeTruthy();
  const payload = await resp.json();
  expect(payload.code).toBe(1000);
  return payload.data.pk as string;
}

/** 发起申请（API，返回实例 pk）：申请人 = 当前登录用户 */
async function startInstance(
  page: Page,
  token: string,
  flowPk: string,
  title: string
) {
  const resp = await page.request.post(
    `${BACKEND_URL}/api/system/approval-instances`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: { flow: flowPk, title, form_data: {} }
    }
  );
  expect(resp.ok(), await resp.text()).toBeTruthy();
  const payload = await resp.json();
  expect(payload.code).toBe(1000);
  return payload.data.pk as string;
}

async function openInstanceCenter(page: Page) {
  await openMenuPath(page, ["系统管理"], "/system/approval/instance/index");
  await expect(page.getByRole("tab", { name: /待我审批/ }).first()).toBeVisible(
    { timeout: 20_000 }
  );
}

test("流程审批：转交待办 → 原待办消失 + 轨迹留痕（申请详情）", async ({
  page
}) => {
  await login(page);
  const token = await getAccessToken(page);
  const stamp = Date.now();
  const title = `E2E转交-${stamp}`;
  const flowPk = await createFlow(page, token, `e2e_transfer_${stamp}`, [
    {
      name: "初审",
      order: 1,
      approve_type: "AND",
      assignee_type: "user",
      assignee_value: APPROVER.username
    }
  ]);
  const instancePk = await startInstance(page, token, flowPk, title);

  // ---- 审批人页面：待办 → 转交 ----
  const browser = page.context().browser();
  const approverContext = await browser!.newContext({
    baseURL: FRONT_URL,
    locale: "zh-CN"
  });
  const approverPage = await approverContext.newPage();
  await login(approverPage, APPROVER);
  await openInstanceCenter(approverPage);

  const pendingRow = approverPage
    .locator(".el-table__row", { hasText: title })
    .first();
  await expect(pendingRow).toBeVisible({ timeout: 20_000 });
  await pendingRow.getByRole("button", { name: "转交" }).first().click();

  const dialog = approverPage.locator(".el-dialog:visible").first();
  await expect(dialog).toContainText(title, { timeout: 10_000 });
  const targetItem = dialog.locator(".el-form-item:has-text('转交给')").first();
  await expect(targetItem).toBeVisible({ timeout: 10_000 });

  // 选人：超管走 SearchUser 弹窗选择器，无该权限时回退用户名输入
  const plainInput = targetItem.getByPlaceholder("请输入被转交人的用户名");
  if ((await plainInput.count()) > 0) {
    await plainInput.fill(PLAIN_USER.username);
  } else {
    await targetItem.locator(".el-select__wrapper").first().click();
    const pickerSearch = approverPage.getByPlaceholder("请输入用户名");
    await pickerSearch.waitFor({ state: "visible", timeout: 15_000 });
    await pickerSearch.fill(PLAIN_USER.username);
    // 「输入 + 搜索按钮」形态：不点搜索则列表保持默认页，目标行可能不在首屏
    await approverPage
      .getByRole("tooltip")
      .filter({ has: pickerSearch })
      .getByRole("button", { name: "搜索" })
      .click();
    const pickerRow = approverPage
      .locator(".el-table")
      .last()
      .locator(".el-table__row")
      .filter({ hasText: PLAIN_USER.username })
      .first();
    await expect(pickerRow).toBeVisible({ timeout: 15_000 });
    await approverPage
      .locator(".el-loading-mask:visible")
      .first()
      .waitFor({ state: "hidden", timeout: 15_000 })
      .catch(() => undefined);
    await pickerRow.click();
    await approverPage
      .locator(".el-select__popper:visible")
      .getByRole("button", { name: "确定" })
      .first()
      .click();
    // 回显断言：选择器交互失败时在此明确暴露（否则会静默以空值提交）
    await expect(targetItem).toContainText(PLAIN_USER.username, {
      timeout: 10_000
    });
  }

  await dialog
    .getByRole("button", { name: /保存|确定/ })
    .first()
    .click();
  const feedback = approverPage.locator(".el-message").first();
  await expect(feedback).toContainText(/transferred|已转交/i, {
    timeout: 15_000
  });
  // 原待办从「待我审批」消失（已转给他人）
  await expect(
    approverPage.locator(".el-table__row", { hasText: title })
  ).toHaveCount(0, { timeout: 20_000 });
  await approverContext.close();

  // ---- 申请人视角：详情轨迹留痕（原任务作废 + 新任务代理来源）----
  await page.reload();
  await openInstanceCenter(page);
  await page.getByRole("tab", { name: "我的申请" }).first().click();
  const myRow = page.locator(".el-table__row", { hasText: title }).first();
  await expect(myRow).toBeVisible({ timeout: 20_000 });
  await myRow.getByRole("button", { name: "申请详情" }).first().click();
  const drawer = page.locator(".el-drawer:visible").first();
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  const trail = drawer.getByTestId("instance-trail");
  // 新任务处理人是转交目标；来源标注（delegate_from → 「由 X 代理」）指向原审批人
  await expect(trail).toContainText(PLAIN_USER.username);
  await expect(trail).toContainText(APPROVER.username);
  await expect(drawer.getByTestId("trail-delegate-from").first()).toBeVisible({
    timeout: 10_000
  });
  await drawer.locator(".el-drawer__close-btn").click();

  // 实例仍在审批中（转交不推进节点）
  await expect(myRow).toContainText("待审批");
  expect(instancePk).toBeTruthy();
});

test("流程审批：管理视角「全部在途」页签可见 + 催办入口", async ({ page }) => {
  await login(page);
  const token = await getAccessToken(page);
  const stamp = Date.now();
  const title = `E2E在途-${stamp}`;
  const flowPk = await createFlow(page, token, `e2e_ongoing_${stamp}`, [
    {
      name: "初审",
      order: 1,
      approve_type: "OR",
      assignee_type: "user",
      assignee_value: APPROVER.username
    }
  ]);
  await startInstance(page, token, flowPk, title);

  await openInstanceCenter(page);
  // 超管具备 ongoing 权限点 → 页签可见
  const ongoingTab = page.getByRole("tab", { name: "全部在途" }).first();
  await expect(ongoingTab).toBeVisible({ timeout: 20_000 });
  await ongoingTab.click();

  const row = page.locator(".el-table__row", { hasText: title }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  // 管理视角行内提供催办入口（我方发起的在途单同样可被管理员巡看）
  await expect(row.getByRole("button", { name: "催办" }).first()).toBeVisible({
    timeout: 10_000
  });
  // 当前处理人列透出（巡看「卡在谁那里」；服务端按昵称呈现，兼容用户名口径）
  await expect(row).toContainText(new RegExp(`${APPROVER.username}|E2E审批人`));
});
