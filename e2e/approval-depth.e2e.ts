import { expect, test, type Page } from "@playwright/test";

import {
  ADMIN,
  APPROVER,
  BACKEND_URL,
  FRONT_URL,
  getAccessToken,
  login
} from "./helpers";

/**
 * 审批流深度用例（审批中心增强）：
 *
 * 1. 通过弹窗可填审批意见 → 流转记录时间线展示意见；
 * 2. 申请人催办（含 10 分钟节流提示）；
 * 3. 驳回后「重新提交」按原流程/原内容预填发起弹窗；
 * 4. 流程定义「分支」路由 target 可选（修复恒禁用缺陷的回归守护）。
 *
 * 跨身份准备/断言统一走一次性浏览器上下文取 token（申请人 admin、审批人 e2e_approver）。
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

/** 建「单节点」流程（审批人 = e2e_approver），返回流程主键 */
async function createFlow(
  page: Page,
  token: string,
  suffix: string,
  name = `E2E深度流程-${suffix}`
): Promise<string> {
  const res = await page.request.post(
    `${BACKEND_URL}/api/system/approval-flows`,
    {
      headers: auth(token),
      data: {
        name,
        code: `e2e_deep_${suffix}`,
        is_active: true,
        form_schema: [{ key: "amount", label: "金额", type: "number" }],
        nodes: [
          {
            name: "初审",
            order: 1,
            approve_type: "OR",
            assignee_type: "user",
            assignee_value: APPROVER.username
          }
        ]
      }
    }
  );
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).data.pk as string;
}

/** 发起申请，返回实例主键 */
async function createInstance(
  page: Page,
  token: string,
  flowPk: string,
  title: string
): Promise<string> {
  const res = await page.request.post(
    `${BACKEND_URL}/api/system/approval-instances`,
    {
      headers: auth(token),
      data: { flow: flowPk, title, form_data: { amount: 100 } }
    }
  );
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).data.pk as string;
}

test("通过弹窗填审批意见：意见入流转记录时间线", async ({ page }) => {
  const adminToken = await tokenFor(page, ADMIN);
  const approverToken = await tokenFor(page, APPROVER);
  const suffix = Math.random().toString(36).slice(2, 8);
  const title = `E2E意见-${suffix}`;
  let flowPk = "";

  try {
    flowPk = await createFlow(page, adminToken, suffix);
    await createInstance(page, adminToken, flowPk, title);

    // 审批人视角：待办页签 → 通过 → 弹窗填意见
    await login(page, APPROVER);
    await page.goto(`${FRONT_URL}/#/system/approval/instance/index`);
    const row = page.getByRole("row", { name: title });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole("button", { name: "通过" }).click();

    const dialog = page.locator(".el-dialog").last();
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder("审批意见（选填）").fill("E2E同意并归档");
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(dialog).not.toBeVisible();

    // 已办页签 → 详情：时间线应出现意见（审批轨迹非表格）
    await page.getByRole("tab", { name: /已办/ }).click();
    const doneRow = page.getByRole("row", { name: title });
    await expect(doneRow).toBeVisible({ timeout: 15_000 });
    await doneRow.getByRole("button", { name: "申请详情" }).click();
    const drawer = page.locator(".el-drawer").last();
    await expect(drawer.getByTestId("instance-trail")).toBeVisible({
      timeout: 10_000
    });
    await expect(drawer.getByTestId("trail-comment")).toContainText(
      "E2E同意并归档"
    );

    // 落库校验：任务意见写入（服务端口径）
    const detail = await page.request.get(
      `${BACKEND_URL}/api/system/approval-instances`,
      {
        headers: auth(approverToken),
        params: { scope: "done", page: 1, size: 50 }
      }
    );
    const rows = (await detail.json())?.data?.results ?? [];
    const instance = rows.find(
      (item: { title: string }) => item.title === title
    );
    expect(instance?.tasks?.[0]?.comment).toBe("E2E同意并归档");
  } finally {
    if (flowPk) {
      await page.request
        .delete(`${BACKEND_URL}/api/system/approval-flows/${flowPk}`, {
          headers: auth(adminToken)
        })
        .catch(() => undefined);
    }
  }
});

test("申请人催办：发送提醒并命中 10 分钟节流", async ({ page }) => {
  await login(page);
  const token = await getAccessToken(page);
  const suffix = Math.random().toString(36).slice(2, 8);
  const title = `E2E催办-${suffix}`;
  let flowPk = "";
  let instancePk = "";

  try {
    flowPk = await createFlow(page, token, suffix);
    instancePk = await createInstance(page, token, flowPk, title);

    await page.goto(`${FRONT_URL}/#/system/approval/instance/index`);
    await page.getByRole("tab", { name: /我的申请/ }).click();
    const row = page.getByRole("row", { name: title });
    await expect(row).toBeVisible({ timeout: 15_000 });

    await row.getByRole("button", { name: "催办" }).click();
    const dialog = page.locator(".el-dialog").last();
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder("催办留言（选填）").fill("E2E请尽快处理");
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText("催办提醒已发送").first()).toBeVisible({
      timeout: 10_000
    });

    // 立即二次催办：服务端节流拒绝（10 分钟内）
    await row.getByRole("button", { name: "催办" }).click();
    const second = page.locator(".el-dialog").last();
    await expect(second).toBeVisible();
    await second.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText(/10 分钟/).first()).toBeVisible({
      timeout: 10_000
    });
  } finally {
    if (instancePk) {
      await page.request
        .post(
          `${BACKEND_URL}/api/system/approval-instances/${instancePk}/cancel`,
          {
            headers: auth(token),
            data: {}
          }
        )
        .catch(() => undefined);
    }
    if (flowPk) {
      await page.request
        .delete(`${BACKEND_URL}/api/system/approval-flows/${flowPk}`, {
          headers: auth(token)
        })
        .catch(() => undefined);
    }
  }
});

test("驳回后重新提交：按原流程与原内容预填发起弹窗", async ({ page }) => {
  const approverToken = await tokenFor(page, APPROVER);
  await login(page);
  const token = await getAccessToken(page);
  const suffix = Math.random().toString(36).slice(2, 8);
  const title = `E2E重提-${suffix}`;
  let flowPk = "";
  let instancePk = "";

  try {
    flowPk = await createFlow(page, token, suffix);
    instancePk = await createInstance(page, token, flowPk, title);
    const rejectRes = await page.request.post(
      `${BACKEND_URL}/api/system/approval-instances/${instancePk}/reject`,
      { headers: auth(approverToken), data: { reason: "E2E信息有误" } }
    );
    expect(rejectRes.ok(), await rejectRes.text()).toBeTruthy();

    await page.goto(`${FRONT_URL}/#/system/approval/instance/index`);
    await page.getByRole("tab", { name: /我的申请/ }).click();
    const row = page.getByRole("row", { name: title });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText("已驳回")).toBeVisible();

    // 重新提交（二次确认）→ 发起弹窗预填原流程与原表单内容
    await row.getByRole("button", { name: "重新提交" }).click();
    await page
      .locator(".el-popconfirm, .el-popper")
      .getByRole("button", { name: "确定" })
      .first()
      .click();
    const dialog = page.locator(".el-dialog").last();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    // 预填校验：标题与表单内容（流程预选由提交成功后新单出现间接覆盖）
    await expect(
      dialog
        .locator(".el-form-item")
        .filter({ hasText: "申请标题" })
        .locator("input")
    ).toHaveValue(title);
    await expect(
      dialog
        .locator(".el-form-item")
        .filter({ hasText: "金额" })
        .locator("input")
    ).toHaveValue("100");

    await dialog.getByRole("button", { name: "提交申请" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });
    // 新申请出现在我的申请（同标题两行：已驳回 + 新的待审批）
    await expect(page.getByRole("row", { name: title })).toHaveCount(2, {
      timeout: 15_000
    });
    await expect(
      page.getByRole("row", { name: title }).first().getByText("待审批")
    ).toBeVisible();
  } finally {
    if (flowPk) {
      await page.request
        .delete(`${BACKEND_URL}/api/system/approval-flows/${flowPk}`, {
          headers: auth(token)
        })
        .catch(() => undefined);
    }
  }
});

test("流程定义：分支路由 target 可选（非自环）并落库", async ({ page }) => {
  await login(page);
  const token = await getAccessToken(page);
  const suffix = Math.random().toString(36).slice(2, 8);
  const flowName = `E2E分支流程-${suffix}`;
  let flowPk = "";

  try {
    const res = await page.request.post(
      `${BACKEND_URL}/api/system/approval-flows`,
      {
        headers: auth(token),
        data: {
          name: flowName,
          code: `e2e_route_${suffix}`,
          is_active: false,
          form_schema: [],
          nodes: [
            {
              name: "初审A",
              order: 1,
              approve_type: "OR",
              assignee_type: "user",
              assignee_value: APPROVER.username
            },
            {
              name: "终审B",
              order: 2,
              approve_type: "OR",
              assignee_type: "user",
              assignee_value: APPROVER.username
            }
          ]
        }
      }
    );
    expect(res.ok(), await res.text()).toBeTruthy();
    flowPk = (await res.json()).data.pk;

    await page.goto(`${FRONT_URL}/#/system/approval-flow/index`);
    const row = page.getByRole("row", { name: flowName });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole("button", { name: "编辑配置" }).click();

    const drawer = page.locator(".el-drawer").last();
    await expect(drawer).toBeVisible({ timeout: 10_000 });
    const nodeRow = drawer.getByRole("row", { name: /终审B/ });
    await nodeRow.getByRole("button", { name: "分支" }).click();

    const routeDialog = page.locator(".el-dialog").last();
    await expect(routeDialog).toBeVisible();
    await routeDialog.getByRole("button", { name: "添加分支" }).click();
    const routeRow = routeDialog.locator(".el-table__row").first();
    // 条件字段必填（服务端口径）：填表单 key 与比较值，保证保存可落库
    // 仅取可编辑文本框（选择器自身的 input 为 readonly，不能按序号混用）
    const editableInputs = routeRow.locator("input:not([readonly])");
    await editableInputs.nth(0).fill("amount");
    await editableInputs.nth(1).fill("100");
    // target 下拉：非自环节点可选，当前节点（顺序 2）禁用
    await routeRow.locator(".el-select").nth(1).click();
    const option1 = page
      .locator(".el-select-dropdown__item")
      .filter({ hasText: "顺序 1" })
      .first();
    const option2 = page
      .locator(".el-select-dropdown__item")
      .filter({ hasText: "顺序 2" })
      .first();
    await expect(option1).toBeVisible({ timeout: 10_000 });
    await expect(option1).not.toHaveClass(/is-disabled/);
    await expect(option2).toHaveClass(/is-disabled/);
    await option1.click();
    // EP 下拉选中后常以可见态残留并拦截点击：点弹窗标题强制收起（既有教训口径）
    await routeDialog.locator(".el-dialog__header").click();
    await routeDialog.getByRole("button", { name: "保存" }).click();
    await expect(routeDialog).not.toBeVisible();

    await drawer.getByRole("button", { name: "保存" }).click();
    await expect(drawer).not.toBeVisible({ timeout: 15_000 });

    const detail = await page.request.get(
      `${BACKEND_URL}/api/system/approval-flows/${flowPk}`,
      { headers: auth(token) }
    );
    const nodes = (await detail.json())?.data?.nodes ?? [];
    const target = nodes.find(
      (node: { name: string }) => node.name === "终审B"
    );
    expect(target?.routes?.[0]?.target).toBe(1);
  } finally {
    if (flowPk) {
      await page.request
        .delete(`${BACKEND_URL}/api/system/approval-flows/${flowPk}`, {
          headers: auth(token)
        })
        .catch(() => undefined);
    }
  }
});
