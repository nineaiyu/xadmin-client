import { expect, test, type Page } from "@playwright/test";

import {
  APPROVER,
  BACKEND_URL,
  FRONT_URL,
  PLAIN_USER,
  getAccessToken,
  login,
  openMenuPath
} from "./helpers";

/**
 * 审批流 P2 动作 E2E：退回指定节点 + 减签（REFACTORING-PLAN §7.1-3/4）。
 *
 * 1）退回：两级流程通过初审后 → 审批人「退回」到初审（目标节点/原因必填）→
 *    实例保持审批中、待办重开、轨迹留痕（已退回至节点 X：原因）；
 * 2）减签：会签节点 API 加签 → 审批人「减签」移除追加候选（轨迹注明减签移除）→
 *    剩余候选通过即流转（减签降低会签所需人数）。
 *
 * 流程定义 / 发起 / 加签经 API 预置，退回与减签走真实 UI。
 */

/** WS 站内信通知（右上角 5s 自动关）会盖住行内按钮：关键点击前等它退场 */
async function waitNotificationsGone(page: Page) {
  await page
    .locator(".el-notification")
    .first()
    .waitFor({ state: "detached", timeout: 12_000 })
    .catch(() => undefined);
}

async function createFlow(
  page: Page,
  token: string,
  code: string,
  nodes: Array<{
    name: string;
    order: number;
    approve_type?: string;
    assignee_type?: string;
    assignee_value?: string;
  }>
) {
  const resp = await page.request.post(
    `${BACKEND_URL}/api/approval/approval-flows`,
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

async function startInstance(
  page: Page,
  token: string,
  flowPk: string,
  title: string
) {
  const resp = await page.request.post(
    `${BACKEND_URL}/api/approval/approval-instances`,
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
  await openMenuPath(page, ["审批"], "/approval/instance/index");
  await expect(page.getByRole("tab", { name: /待我审批/ }).first()).toBeVisible(
    { timeout: 20_000 }
  );
}

test("流程审批：通过初审后退回 → 待办重开 + 轨迹留痕", async ({ page }) => {
  await login(page);
  const token = await getAccessToken(page);
  const stamp = Date.now();
  const title = `E2E退回-${stamp}`;
  const reason = `材料不全E2E-${stamp}`;
  const flowPk = await createFlow(page, token, `e2e_return_${stamp}`, [
    {
      name: "初审",
      order: 1,
      approve_type: "AND",
      assignee_type: "user",
      assignee_value: APPROVER.username
    },
    {
      name: "终审",
      order: 2,
      approve_type: "OR",
      assignee_type: "user",
      assignee_value: APPROVER.username
    }
  ]);
  await startInstance(page, token, flowPk, title);

  const browser = page.context().browser();
  const approverContext = await browser!.newContext({
    baseURL: FRONT_URL,
    locale: "zh-CN"
  });
  const approverPage = await approverContext.newPage();
  await login(approverPage, APPROVER);
  await openInstanceCenter(approverPage);

  // 初审通过 → 推进到终审（行仍在「待我审批」：终审同为该审批人）
  const row = approverPage
    .locator(".el-table__row", { hasText: title })
    .first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.getByRole("button", { name: "通过" }).first().click();
  const approveDialog = approverPage.locator(".el-dialog:visible").first();
  await approveDialog
    .getByRole("button", { name: /保存|确定/ })
    .first()
    .click();
  await waitNotificationsGone(approverPage);
  await expect(row).toBeVisible({ timeout: 20_000 });

  // 退回：目标节点默认 = 上一途经节点（初审），填写原因提交
  await row.getByRole("button", { name: "退回" }).first().click();
  const dialog = approverPage.locator(".el-dialog:visible").first();
  await expect(dialog).toContainText("退回至节点", { timeout: 10_000 });
  await expect(dialog).toContainText("初审", { timeout: 10_000 });
  await dialog.getByPlaceholder("请输入退回原因（必填）").fill(reason);
  await dialog
    .getByRole("button", { name: /保存|确定/ })
    .first()
    .click();
  await expect(approverPage.locator(".el-message").first()).toContainText(
    /已退回/,
    { timeout: 15_000 }
  );

  // 退回后实例仍在审批中且回到初审：详情轨迹注明退回节点与原因
  const pendingRow = approverPage
    .locator(".el-table__row", { hasText: title })
    .first();
  await expect(pendingRow).toBeVisible({ timeout: 20_000 });
  await pendingRow.getByRole("button", { name: "申请详情" }).first().click();
  const drawer = approverPage.locator(".el-drawer:visible").first();
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  const trail = drawer.getByTestId("instance-trail");
  await expect(trail).toContainText("已退回至节点 初审", {
    timeout: 10_000
  });
  await expect(trail).toContainText(reason);
  await approverContext.close();
});

test("流程审批：会签加签后减签 → 剩余候选通过即流转", async ({ page }) => {
  await login(page);
  const token = await getAccessToken(page);
  const stamp = Date.now();
  const title = `E2E减签-${stamp}`;
  const flowPk = await createFlow(page, token, `e2e_rmsign_${stamp}`, [
    {
      name: "会签",
      order: 1,
      approve_type: "AND",
      assignee_type: "user",
      assignee_value: APPROVER.username
    }
  ]);
  const instancePk = await startInstance(page, token, flowPk, title);

  // API 加签（审批人身份）：追加 E2E普通用户 为会签候选
  const addSignResp = await page.request.post(
    `${BACKEND_URL}/api/approval/approval-instances/${instancePk}/add-sign`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: { usernames: PLAIN_USER.username, comment: "请协助会审" }
    }
  );
  expect(addSignResp.ok(), await addSignResp.text()).toBeTruthy();
  expect((await addSignResp.json()).code).toBe(1000);

  const browser = page.context().browser();
  const approverContext = await browser!.newContext({
    baseURL: FRONT_URL,
    locale: "zh-CN"
  });
  const approverPage = await approverContext.newPage();
  await login(approverPage, APPROVER);
  await openInstanceCenter(approverPage);

  // 减签：弹窗内默认选中当前节点的加签候选（E2E普通用户），直接确认
  const row = approverPage
    .locator(".el-table__row", { hasText: title })
    .first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.getByRole("button", { name: "减签" }).first().click();
  const dialog = approverPage.locator(".el-dialog:visible").first();
  await expect(dialog).toContainText(PLAIN_USER.nickname, {
    timeout: 10_000
  });
  await dialog
    .getByRole("button", { name: /保存|确定/ })
    .first()
    .click();
  await expect(approverPage.locator(".el-message").first()).toContainText(
    /已移除加签审批人/,
    { timeout: 15_000 }
  );

  // 减签后剩余候选（仅 e2e_approver）通过即满足会签 → 详情轨迹注明减签移除
  await waitNotificationsGone(approverPage);
  await row.getByRole("button", { name: "通过" }).first().click();
  const approveDialog = approverPage.locator(".el-dialog:visible").first();
  await approveDialog
    .getByRole("button", { name: /保存|确定/ })
    .first()
    .click();
  await waitNotificationsGone(approverPage);
  await expect(
    approverPage.locator(".el-table__row", { hasText: title })
  ).toHaveCount(0, { timeout: 20_000 });

  // 申请人视角：实例已通过，轨迹保留减签移除的审计行
  await page.reload();
  await openInstanceCenter(page);
  await page.getByRole("tab", { name: "我的申请" }).first().click();
  const myRow = page.locator(".el-table__row", { hasText: title }).first();
  await expect(myRow).toBeVisible({ timeout: 20_000 });
  await expect(myRow).toContainText("已通过");
  await myRow.getByRole("button", { name: "申请详情" }).first().click();
  const drawer = page.locator(".el-drawer:visible").first();
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  const trail = drawer.getByTestId("instance-trail");
  await expect(trail).toContainText("减签移除", { timeout: 10_000 });
  await approverContext.close();
});
