import { expect, test, type Page } from "@playwright/test";

import { AesEncrypted } from "../src/utils/aes";

import {
  APPROVER,
  BACKEND_URL,
  FRONT_URL,
  getAccessToken,
  login,
  openMenuPath
} from "./helpers";

/** WS 站内信通知（右上角 5s 自动关）会盖住行内按钮：关键点击前等它退场 */
async function waitNotificationsGone(page: Page) {
  await page
    .locator(".el-notification")
    .first()
    .waitFor({ state: "detached", timeout: 12_000 })
    .catch(() => undefined);
}

/**
 * 多级审批链 E2E（审批规则）：路径命中规则后按级次逐级审批。
 *
 * - 初审（OR）= e2e_approver；复核（AND）= e2e_approver + e2e_user；
 * - 覆盖：拦截建单 → 逐级推进（列表显示「第 N 级：候选人」）→ 会签等待（1/2，
 *   第二人无 API 审批权限，作为进度展示断言）→ 申请人撤回清理；
 * - 初审驳回 → 整单终止（其余级作废）；两级通过 → 令牌重发删除成功。
 *
 * 拦截清单（APPROVAL_REQUIRED_PATHS）用例内开启、finally 复位；规则用例内
 * 创建并在 finally 停用，避免污染 approval.e2e.ts 等既有用例的全局审批人行为。
 */

const APPROVAL_PATHS_CONFIG_PK = "e9a6b7c8-d9e0-4f1a-9b2c-3d4e5f6a7b0f";

async function setApprovalPaths(page: Page, token: string, paths: string[]) {
  // router 为 trailing_slash=False：detail 路由不能带尾斜杠（否则 Django 404 HTML 页）
  const response = await page.request.patch(
    `${BACKEND_URL}/api/system/config/system/${APPROVAL_PATHS_CONFIG_PK}`,
    { headers: { Authorization: `Bearer ${token}` }, data: { value: paths } }
  );
  expect(response.ok(), await response.text()).toBeTruthy();
}

interface ChainRule {
  pk: string;
}

async function createChainRule(
  page: Page,
  token: string,
  name: string,
  levels: Array<Record<string, unknown>>
): Promise<ChainRule> {
  const response = await page.request.post(
    `${BACKEND_URL}/api/system/approval-rules`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name,
        path_patterns: ["api/system/user/(?P<pk>[^/.]+)$"],
        priority: 100,
        is_active: true,
        levels
      }
    }
  );
  const payload = await response.json();
  expect(payload?.data?.pk, JSON.stringify(payload)).toBeTruthy();
  return { pk: payload.data.pk as string };
}

async function disableRule(page: Page, token: string, pk: string) {
  await page.request
    .patch(`${BACKEND_URL}/api/system/approval-rules/${pk}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { is_active: false }
    })
    .catch(() => undefined);
}

async function submitDelete(page: Page, token: string, userPk: string) {
  const denied = await page.request.delete(
    `${BACKEND_URL}/api/system/user/${userPk}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  expect(denied.status(), await denied.text()).toBe(412);
  const body = await denied.json();
  expect(body?.data?.approval_id).toBeTruthy();
  return String(body.data.approval_id);
}

test.describe.serial("审批规则多级审批链", () => {
  test("逐级通过 → 会签等待 → 撤回清理", async ({ page }) => {
    await login(page);
    const token = await getAccessToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // 待删除用户（申请人对敏感操作发起删除 → 412 建单）；密码走 AES v2 加密
    const username = `e2e_chain_u_${Date.now()}`;
    const created = await page.request.post(`${BACKEND_URL}/api/system/user`, {
      headers,
      data: {
        username,
        nickname: "e2e-chain",
        password: await AesEncrypted(username, "E2E-Chain-2026!")
      }
    });
    const createdPayload = await created.json();
    const userPk = createdPayload?.data?.pk as string;
    expect(userPk, JSON.stringify(createdPayload)).toBeTruthy();

    const rule = await createChainRule(page, token, "E2E 链-逐级", [
      {
        order: 1,
        name: "初审",
        approve_type: "OR",
        assignee_type: "user",
        assignee_value: APPROVER.username
      },
      {
        order: 2,
        name: "复核",
        approve_type: "AND",
        assignee_type: "user",
        assignee_value: `${APPROVER.username},e2e_user`
      }
    ]);

    try {
      await setApprovalPaths(page, token, ["^/api/system/user/[^/]+$"]);
      const approvalId = await submitDelete(page, token, userPk);
      const no8 = approvalId.slice(0, 8).toUpperCase();

      // 初审（e2e_approver，第二超管）在审批中心通过 → 推进到复核级
      const browser = page.context().browser();
      const contextB = await browser!.newContext({
        baseURL: FRONT_URL,
        locale: "zh-CN"
      });
      const pageB = await contextB.newPage();
      await login(pageB, APPROVER);
      await openMenuPath(pageB, ["系统管理"], "/system/approval/index");
      const table = pageB.locator(".el-table").first();
      await expect(table).toBeVisible({ timeout: 15_000 });
      const row = pageB.locator(".el-table__row", { hasText: no8 }).first();
      await row.waitFor({ state: "visible", timeout: 15_000 });
      // 「审批人」列显示当前级候选人（第 1 级：e2e_approver）
      await expect(row).toContainText("第 1 级");

      await row.getByRole("button", { name: "通过" }).first().click();
      await pageB
        .locator(".el-popconfirm, .el-popper, .el-message-box")
        .getByRole("button", { name: "确定" })
        .first()
        .click();

      // 初审通过会向复核级候选人推 WS 通知弹窗（盖住行按钮），等它退场
      await waitNotificationsGone(pageB);

      // 复核级（AND）：候选人 e2e_approver + e2e_user，列表推进显示「第 2 级」
      await expect(row).toContainText("第 2 级", { timeout: 15_000 });

      // 复核第一人通过 → 会签等待（1/2），单仍停在当前级
      await row.getByRole("button", { name: "通过" }).first().click();
      await pageB
        .locator(".el-popconfirm, .el-popper, .el-message-box")
        .getByRole("button", { name: "确定" })
        .first()
        .click();
      await expect(row).toContainText("第 2 级", { timeout: 15_000 });

      // 审批进度弹窗：会签标签 + 已通过 1/2 + 逐人动作留痕
      await row.locator(".el-link", { hasText: "第 2 级" }).first().click();
      const progress = pageB.locator(".el-dialog:visible").first();
      await expect(progress).toBeVisible({ timeout: 10_000 });
      await expect(progress).toContainText("会签");
      await expect(progress).toContainText("已通过 1/2");
      await progress.locator(".el-dialog__headerbtn").first().click();
      await expect(progress).not.toBeVisible({ timeout: 10_000 });

      // 申请人撤回：单终止、在途级次清理（引擎口径由单测守护，这里验证 UI 链路）
      await contextB.close();
      await openMenuPath(page, ["系统管理"], "/system/approval/index");
      const mineTab = page
        .locator(".el-tabs__item", { hasText: "我发起的" })
        .first();
      await mineTab.click();
      const mineRow = page.locator(".el-table__row", { hasText: no8 }).first();
      await mineRow.waitFor({ state: "visible", timeout: 15_000 });
      await mineRow.getByRole("button", { name: "撤回" }).first().click();
      await page
        .locator(".el-popconfirm, .el-popper, .el-message-box")
        .getByRole("button", { name: "确定" })
        .first()
        .click();
      const detail = await page.request
        .get(`${BACKEND_URL}/api/system/approvals/${approvalId}`, { headers })
        .then(res => res.json());
      expect(detail?.data?.status?.value).toBe("CANCELLED");
      expect(Number(detail?.data?.current_level ?? 0)).toBe(0);
    } finally {
      await disableRule(page, token, rule.pk);
      await setApprovalPaths(page, token, []).catch(() => undefined);
    }
  });

  test("初审驳回终止 + 两级通过后令牌重发删除成功", async ({ page }) => {
    await login(page);
    const token = await getAccessToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const username = `e2e_chain_r_${Date.now()}`;
    const created = await page.request.post(`${BACKEND_URL}/api/system/user`, {
      headers,
      data: {
        username,
        nickname: "e2e-chain-reject",
        password: await AesEncrypted(username, "E2E-Chain-2026!")
      }
    });
    const createdPayload = await created.json();
    const userPk = createdPayload?.data?.pk as string;
    expect(userPk, JSON.stringify(createdPayload)).toBeTruthy();

    const rule = await createChainRule(page, token, "E2E 链-驳回与重发", [
      {
        order: 1,
        name: "初审",
        approve_type: "OR",
        assignee_type: "user",
        assignee_value: APPROVER.username
      },
      {
        order: 2,
        name: "复核",
        approve_type: "OR",
        assignee_type: "user",
        assignee_value: APPROVER.username
      }
    ]);

    try {
      await setApprovalPaths(page, token, ["^/api/system/user/[^/]+$"]);

      // 单 A：初审驳回 → 整单终止
      const rejectedId = await submitDelete(page, token, userPk);
      const browser = page.context().browser();
      const contextB = await browser!.newContext({
        baseURL: FRONT_URL,
        locale: "zh-CN"
      });
      const pageB = await contextB.newPage();
      await login(pageB, APPROVER);
      await openMenuPath(pageB, ["系统管理"], "/system/approval/index");
      const table = pageB.locator(".el-table").first();
      await expect(table).toBeVisible({ timeout: 15_000 });

      const rejectedNo = rejectedId.slice(0, 8).toUpperCase();
      const rejectedRow = pageB
        .locator(".el-table__row", { hasText: rejectedNo })
        .first();
      await rejectedRow.waitFor({ state: "visible", timeout: 15_000 });
      await rejectedRow.getByRole("button", { name: "驳回" }).first().click();
      const rejectDialog = pageB.locator(".el-dialog:visible").first();
      await expect(rejectDialog).toBeVisible({ timeout: 10_000 });
      await rejectDialog.locator("textarea").first().fill("E2E 链驳回");
      await rejectDialog
        .getByRole("button", { name: /保存|确定/ })
        .first()
        .click();
      await expect(rejectedRow).toHaveCount(0, { timeout: 15_000 });

      // 单 B：两级全部通过 → 申请人携令牌重发删除成功
      const approvedId = await submitDelete(page, token, userPk);
      const approvedNo = approvedId.slice(0, 8).toUpperCase();
      const levelRow = pageB
        .locator(".el-table__row", { hasText: approvedNo })
        .first();
      await levelRow.waitFor({ state: "visible", timeout: 15_000 });

      await levelRow.getByRole("button", { name: "通过" }).first().click();
      await pageB
        .locator(".el-popconfirm, .el-popper, .el-message-box")
        .getByRole("button", { name: "确定" })
        .first()
        .click();
      await waitNotificationsGone(pageB);
      // 第一级通过 → 推进到第二级（OR 单人级）
      await expect(levelRow).toContainText("第 2 级", { timeout: 15_000 });

      await levelRow.getByRole("button", { name: "通过" }).first().click();
      await pageB
        .locator(".el-popconfirm, .el-popper, .el-message-box")
        .getByRole("button", { name: "确定" })
        .first()
        .click();
      // 末级通过 → 整单 APPROVED，行离开「待我审批」
      await expect(levelRow).toHaveCount(0, { timeout: 15_000 });

      const detail = await page.request
        .get(`${BACKEND_URL}/api/system/approvals/${approvedId}`, { headers })
        .then(res => res.json());
      expect(detail?.data?.status?.value).toBe("APPROVED");

      await contextB.close();

      // 申请人等「审批通过」WS 通知弹窗消失后再重发（5s 自动关闭）
      await page
        .locator(".el-notification")
        .first()
        .waitFor({ state: "detached", timeout: 12_000 })
        .catch(() => undefined);
      const deleteAgain = await page.request.delete(
        `${BACKEND_URL}/api/system/user/${userPk}`,
        {
          headers: { ...headers, "X-Approval-Id": approvedId }
        }
      );
      expect(deleteAgain.status(), await deleteAgain.text()).toBe(200);
    } finally {
      await disableRule(page, token, rule.pk);
      await setApprovalPaths(page, token, []).catch(() => undefined);
    }
  });
});
