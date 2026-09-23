import { expect, test, type Page } from "@playwright/test";

import {
  APPROVER,
  BACKEND_URL,
  getAccessToken,
  login,
  openMenuPath
} from "./helpers";

/**
 * 审批决策信息完备E2E：
 *
 * 1. 敏感操作审批：删除角色被拦截建单后，审批中心「审批人」列链接打开详情弹窗，
 *    展示目标对象快照（对象身份 + 变更对照）；
 * 2. 流程审批：请假实例详情抽屉展示「关联业务对象」卡片（业务类型 / 对象 / 状态）。
 */

const APPROVAL_PATHS_CONFIG_PK = "e9a6b7c8-d9e0-4f1a-9b2c-3d4e5f6a7b0f";

async function setApprovalPaths(page: Page, token: string, paths: string[]) {
  const response = await page.request.patch(
    `${BACKEND_URL}/api/system/config/system/${APPROVAL_PATHS_CONFIG_PK}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: { value: paths }
    }
  );
  expect(response.ok(), await response.text()).toBeTruthy();
}

test("敏感操作审批：详情弹窗展示目标对象快照", async ({ page }) => {
  await login(page);
  const token = await getAccessToken(page);
  const headers = { Authorization: `Bearer ${token}` };
  const suffix = Date.now();
  const roleName = `E2E快照角色${suffix}`;
  let rolePk = "";
  let approvalPk = "";

  try {
    await setApprovalPaths(page, token, ["^/api/system/role/"]);
    const roleResp = await page.request.post(`${BACKEND_URL}/api/system/role`, {
      headers,
      // fields 为字段权限地图（write_only 必填）：空对象 = 不设字段权限
      data: { name: roleName, code: `e2e_snapshot_${suffix}`, fields: {} }
    });
    expect(roleResp.ok(), await roleResp.text()).toBeTruthy();
    rolePk = ((await roleResp.json()) as { data: { pk: string } }).data.pk;

    // UI 删除 → 412 建单（业务未执行）
    await openMenuPath(page, ["系统管理", "权限管理"], "/system/role/index");
    const row = page.locator(".el-table__row", { hasText: roleName }).first();
    await row.waitFor({ state: "visible", timeout: 30_000 });
    await row.getByRole("button", { name: "删除" }).first().click();
    await page
      .locator(".el-popconfirm, .el-popper, .el-message-box")
      .getByRole("button", { name: "确定" })
      .first()
      .click();
    await expect(page.locator(".el-message").first()).toContainText(
      "已提交审批",
      { timeout: 10_000 }
    );

    // 审批中心：「我发起的」页签（申请人是 xadmin 本人，不能出现在待我审批），
    // 按 object_pk（角色主键）定位该单，点「审批人」列链接打开详情
    await openMenuPath(page, ["系统管理"], "/system/approval/index");
    await page
      .locator(".el-tabs__item", { hasText: "我发起的" })
      .first()
      .click();
    const approvalRow = page
      .locator(".el-table__row", { hasText: rolePk })
      .first();
    await approvalRow.waitFor({ state: "visible", timeout: 20_000 });
    await approvalRow.locator(".el-link").first().click();

    const dialog = page.locator(".el-dialog:visible").first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const snapshot = dialog.locator('[data-testid="approval-target-snapshot"]');
    await expect(snapshot).toBeVisible({ timeout: 10_000 });
    await expect(snapshot).toContainText(roleName);

    // 记录单号，供清理阶段撤回
    const pending = await page.request.get(
      `${BACKEND_URL}/api/system/approvals?scope=pending&object_pk=${rolePk}`,
      { headers }
    );
    const results = (
      (await pending.json()) as { data?: { results?: unknown[] } }
    ).data?.results as Array<{ pk: string }> | undefined;
    approvalPk = results?.[0]?.pk ?? "";
  } finally {
    await setApprovalPaths(page, token, []).catch(() => undefined);
    if (approvalPk) {
      await page.request
        .post(`${BACKEND_URL}/api/system/approvals/${approvalPk}/cancel`, {
          headers,
          data: {}
        })
        .catch(() => undefined);
    }
    if (rolePk) {
      await page.request
        .delete(
          `${BACKEND_URL}/api/system/role/${rolePk}?impact_confirmed=true`,
          {
            headers
          }
        )
        .catch(() => undefined);
    }
  }
});

test("流程审批详情：展示关联业务对象（请假单）", async ({ page }) => {
  await login(page);
  const token = await getAccessToken(page);
  const headers = { Authorization: `Bearer ${token}` };
  const suffix = Date.now();
  // 请假日期在 2035 年内按毫秒递增取点：实例标题含该日期，既用于稳定定位行，
  // 也规避与其它用例/残留数据的请假重叠校验（注意不能用位运算：Date.now()
  // 超 32 位会被截断成负数，曾导致非法日期）
  const dateCursor = new Date(Date.UTC(2035, 0, 1));
  dateCursor.setUTCDate(dateCursor.getUTCDate() + (suffix % 330));
  const startDate = dateCursor.toISOString().slice(0, 10);
  let flowPk = "";
  let ownsFlow = false;
  let leavePk = "";
  let instancePk = "";
  let configPk = "";
  let leaveFlowCodeBackup = "";

  try {
    // 请假流程：库中既有 leave 流程的首节点是「部门负责人」类型，E2E 超管无部门会被
    // fail-closed 拒绝——本用例改用临时流程：创建唯一 code 的流程（审批人 = 第二超管），
    // 并把 LEAVE_APPROVAL_FLOW_CODE 指向它（finally 复位），保证提交可成功。
    const flowResp = await page.request.post(
      `${BACKEND_URL}/api/system/approval-flows`,
      {
        headers,
        data: {
          name: `E2E请假流程-${suffix}`,
          code: `e2e_leave_${suffix}`,
          is_active: true,
          form_schema: [],
          nodes: [
            {
              name: "直属审批",
              order: 1,
              approve_type: "OR",
              assignee_type: "user",
              assignee_value: APPROVER.username,
              condition: {},
              routes: []
            }
          ]
        }
      }
    );
    expect(flowResp.ok(), await flowResp.text()).toBeTruthy();
    const flowBody = (await flowResp.json()) as {
      code: number;
      data?: { pk: string };
      detail?: string;
    };
    expect(flowBody.code, JSON.stringify(flowBody)).toBe(1000);
    flowPk = flowBody.data?.pk ?? "";
    ownsFlow = true;

    // 指向临时流程（SysConfig 热更新），记录原值供 finally 复位
    const configList = await page.request.get(
      `${BACKEND_URL}/api/system/config/system?key=${encodeURIComponent("LEAVE_APPROVAL_FLOW_CODE")}`,
      { headers }
    );
    const configRows = (
      (await configList.json()) as {
        data?: { results?: Array<{ pk: string; value?: unknown }> };
      }
    ).data?.results;
    configPk = configRows?.[0]?.pk ?? "";
    leaveFlowCodeBackup = (configRows?.[0]?.value ?? "") as string;
    expect(
      configPk,
      "LEAVE_APPROVAL_FLOW_CODE config row should exist"
    ).toBeTruthy();
    const patched = await page.request.patch(
      `${BACKEND_URL}/api/system/config/system/${configPk}`,
      { headers, data: { value: `e2e_leave_${suffix}` } }
    );
    expect(patched.ok(), await patched.text()).toBeTruthy();

    const leaveResp = await page.request.post(
      `${BACKEND_URL}/api/system/leaves`,
      {
        headers,
        data: {
          leave_type: "annual",
          start_date: startDate,
          end_date: startDate,
          days: "1.0",
          reason: `E2E关联卡片-${suffix}`
        }
      }
    );
    expect(leaveResp.ok(), await leaveResp.text()).toBeTruthy();
    leavePk = ((await leaveResp.json()) as { data: { pk: string } }).data.pk;

    const submitResp = await page.request.post(
      `${BACKEND_URL}/api/system/leaves/${leavePk}/submit`,
      { headers, data: {} }
    );
    expect(submitResp.ok(), await submitResp.text()).toBeTruthy();

    // 实例按 biz_id 精确匹配（leave 主键）：不依赖标题文案与列表顺序
    const instances = await page.request.get(
      `${BACKEND_URL}/api/system/approval-instances?size=50`,
      { headers }
    );
    const rows = (
      (await instances.json()) as { data?: { results?: unknown[] } }
    ).data?.results as
      Array<{ pk: string; title: string; biz_id?: string }> | undefined;
    const instance = (rows ?? []).find(
      item => String(item.biz_id ?? "") === String(leavePk)
    );
    expect(instance, "leave instance should exist").toBeTruthy();
    instancePk = instance!.pk;

    // UI：流程审批列表（申请人视角在「我的申请」页签）→ 行「详情」抽屉 →
    // 关联业务对象卡片
    await openMenuPath(page, ["系统管理"], "/system/approval/instance/index");
    await page
      .locator(".el-tabs__item", { hasText: "我的申请" })
      .first()
      .click();
    const row = page.locator(".el-table__row", { hasText: startDate }).first();
    await row.waitFor({ state: "visible", timeout: 30_000 });
    await row.getByRole("button", { name: "详情" }).first().click();

    const drawer = page.locator(".el-drawer:visible").first();
    await expect(drawer).toBeVisible({ timeout: 10_000 });
    const related = drawer.locator('[data-testid="instance-related-object"]');
    await expect(related).toBeVisible({ timeout: 10_000 });
    await expect(related).toContainText("请假申请");
    await expect(related).toContainText(startDate);
  } finally {
    // 兜底：实例未记录时按 biz_id 反查（取消后业务单回写为可删状态）
    let cancelPk = instancePk;
    if (!cancelPk && leavePk) {
      const listed = await page.request
        .get(`${BACKEND_URL}/api/system/approval-instances?size=50`, {
          headers
        })
        .catch(() => undefined);
      const rows = listed
        ? (
            (await listed.json()) as {
              data?: { results?: Array<{ pk: string; biz_id?: string }> };
            }
          ).data?.results
        : undefined;
      cancelPk =
        (rows ?? []).find(item => String(item.biz_id ?? "") === String(leavePk))
          ?.pk ?? "";
    }
    if (cancelPk) {
      await page.request
        .post(
          `${BACKEND_URL}/api/system/approval-instances/${cancelPk}/cancel`,
          {
            headers,
            data: {}
          }
        )
        .catch(() => undefined);
    }
    if (leavePk) {
      await page.request
        .delete(`${BACKEND_URL}/api/system/leaves/${leavePk}`, { headers })
        .catch(() => undefined);
    }
    if (configPk) {
      await page.request
        .patch(`${BACKEND_URL}/api/system/config/system/${configPk}`, {
          headers,
          data: { value: leaveFlowCodeBackup }
        })
        .catch(() => undefined);
    }
    if (flowPk && ownsFlow) {
      await page.request
        .delete(`${BACKEND_URL}/api/system/approval-flows/${flowPk}`, {
          headers
        })
        .catch(() => undefined);
    }
  }
});
