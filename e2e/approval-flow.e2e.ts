import { expect, test, type Page } from "@playwright/test";

import {
  APPROVER,
  BACKEND_URL,
  FRONT_URL,
  getAccessToken,
  login,
  openMenuPath
} from "./helpers";

/**
 * 全量审批流引擎一期 E2E（ADR-012）：
 * 1）主链路：发起申请（UI 选流程 + 动态表单）→ 审批人待办通过（两节点）→ 申请人「我的申请」已通过；
 * 2）驳回链路：审批人填原因驳回 → 申请人「我的申请」已驳回（含详情抽屉轨迹）；
 * 3）流程定义页：列表 + 「编辑配置」抽屉（列表式节点编辑）可见。
 *
 * 流程定义经 API 预置（配置抽屉的表单交互冗长且已被 UI 断言覆盖），业务动作全部走真实 UI。
 */

const FLOW_LIST_URL = "/system/approval/instance/index";
const FLOW_DEF_URL = "/system/approval-flow/index";

type NodePayload = {
  name: string;
  order: number;
  approve_type?: string;
  assignee_type?: string;
  assignee_value?: string;
  condition?: Record<string, unknown>;
};

/** 建流程（超管 token）：返回流程 pk；code 需全局唯一（用例内拼时间戳） */
async function createFlow(
  page: Page,
  token: string,
  code: string,
  nodes: NodePayload[],
  formSchema: Array<Record<string, unknown>> = []
) {
  const resp = await page.request.post(
    `${BACKEND_URL}/api/system/approval-flows`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: `E2E流程-${code}`,
        code,
        form_schema: formSchema,
        nodes
      }
    }
  );
  expect(resp.ok(), await resp.text()).toBeTruthy();
  const payload = await resp.json();
  expect(payload.code).toBe(1000);
  return payload.data.pk as string;
}

/** 打开「流程审批」页并等待页签渲染 */
async function openInstanceCenter(page: Page) {
  await openMenuPath(page, ["系统管理"], FLOW_LIST_URL);
  await expect(page.getByRole("tab", { name: /待我审批/ }).first()).toBeVisible(
    { timeout: 20_000 }
  );
}

test("流程审批：发起申请 → 两级会签通过 → 我的申请已通过", async ({ page }) => {
  await login(page);
  const token = await getAccessToken(page);
  const stamp = Date.now();
  const title = `E2E申请-${stamp}`;
  const flowName = `E2E流程-e2e_flow_${stamp}`;
  await createFlow(
    page,
    token,
    `e2e_flow_${stamp}`,
    [
      {
        name: "初审",
        order: 1,
        approve_type: "OR",
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
    ],
    [
      {
        key: "days",
        label: "天数",
        type: "number",
        required: true,
        options: []
      }
    ]
  );

  await openInstanceCenter(page);

  // ---- 发起申请（UI：选流程 → 填标题与动态字段 → 提交）----
  await page.getByRole("button", { name: "发起申请" }).first().click();
  const dialog = page.locator(".el-dialog:visible").first();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog.locator(".el-select").first().click();
  await page
    .locator(".el-select-dropdown__item", { hasText: flowName })
    .first()
    .click();
  await dialog.locator("input").nth(1).fill(title);
  // 动态字段（天数，必填）：定位带 label「天数」的 form-item
  await dialog
    .locator(".el-form-item", { hasText: "天数" })
    .locator("input")
    .first()
    .fill("3");
  await dialog.getByRole("button", { name: "提交申请" }).click();

  // 提交成功后自动切到「我的申请」并展示新申请（状态：审批中）
  const mineTab = page.getByRole("tab", { name: "我的申请" }).first();
  await expect(mineTab).toHaveAttribute("aria-selected", "true", {
    timeout: 15_000
  });
  const myRow = page.locator(".el-table__row", { hasText: title }).first();
  await expect(myRow).toBeVisible({ timeout: 20_000 });
  await expect(myRow).toContainText("待审批");
  // 详情抽屉：表单数据按 form_schema 渲染（天数），审批轨迹含首节点
  await myRow.getByRole("button", { name: "申请详情" }).first().click();
  const detailDrawer = page.locator(".el-drawer:visible").first();
  await expect(detailDrawer).toBeVisible({ timeout: 15_000 });
  await expect(detailDrawer).toContainText("天数");
  await expect(detailDrawer).toContainText("初审");
  await detailDrawer.locator(".el-drawer__close-btn").click();

  // ---- 审批人：待办页签通过两次（两节点串行推进）----
  const browser = page.context().browser();
  const approverContext = await browser!.newContext({
    baseURL: FRONT_URL,
    locale: "zh-CN"
  });
  const approverPage = await approverContext.newPage();
  await login(approverPage, APPROVER);
  await openInstanceCenter(approverPage);
  const confirmPopconfirm = async () => {
    await approverPage
      .locator(".el-popconfirm, .el-popper, .el-message-box")
      .getByRole("button", { name: "确定" })
      .first()
      .click();
  };
  const pendingRow = approverPage
    .locator(".el-table__row", { hasText: title })
    .first();
  await expect(pendingRow).toBeVisible({ timeout: 20_000 });
  await pendingRow.getByRole("button", { name: "通过" }).first().click();
  await confirmPopconfirm();

  // 首节点通过后流转到终审：行仍在待办（第二节点待我审批）
  await expect(pendingRow).toBeVisible({ timeout: 20_000 });
  await expect(pendingRow).toContainText("终审", { timeout: 20_000 });
  await pendingRow.getByRole("button", { name: "通过" }).first().click();
  await confirmPopconfirm();
  await expect(
    approverPage.locator(".el-table__row", { hasText: title })
  ).toHaveCount(0, { timeout: 20_000 });

  // 已办页签可见两条轨迹行（同一实例聚合展示）
  await approverPage.getByRole("tab", { name: "已办" }).first().click();
  await expect(
    approverPage.locator(".el-table__row", { hasText: title }).first()
  ).toBeVisible({ timeout: 20_000 });
  await approverContext.close();

  // ---- 申请人：我的申请状态变为已通过 ----
  await page.reload();
  await openInstanceCenter(page);
  await page.getByRole("tab", { name: "我的申请" }).first().click();
  const finalRow = page.locator(".el-table__row", { hasText: title }).first();
  await expect(finalRow).toBeVisible({ timeout: 20_000 });
  await expect(finalRow).toContainText("已通过", { timeout: 20_000 });
});

test("流程审批：驳回链路（必填原因）→ 我的申请已驳回", async ({ page }) => {
  await login(page);
  const token = await getAccessToken(page);
  const stamp = Date.now();
  const title = `E2E驳回-${stamp}`;
  const flowName = `E2E流程-e2e_reject_${stamp}`;
  await createFlow(page, token, `e2e_reject_${stamp}`, [
    {
      name: "审批",
      order: 1,
      approve_type: "OR",
      assignee_type: "user",
      assignee_value: APPROVER.username
    }
  ]);

  await openInstanceCenter(page);
  await page.getByRole("button", { name: "发起申请" }).first().click();
  const dialog = page.locator(".el-dialog:visible").first();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog.locator(".el-select").first().click();
  await page
    .locator(".el-select-dropdown__item", { hasText: flowName })
    .first()
    .click();
  await dialog.locator("input").nth(1).fill(title);
  await dialog.getByRole("button", { name: "提交申请" }).click();
  await expect(
    page.locator(".el-table__row", { hasText: title }).first()
  ).toBeVisible({ timeout: 20_000 });

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
  await pendingRow.getByRole("button", { name: "驳回" }).first().click();

  // 驳回原因必填：不填点确定应提示；填写后再确认
  const rejectDialog = approverPage.locator(".el-dialog:visible").first();
  await expect(rejectDialog).toBeVisible({ timeout: 15_000 });
  // ReDialog 默认确认按钮文案为「保存」（buttons.save），与既有审批用例同口径
  const confirmReject = () =>
    rejectDialog
      .getByRole("button", { name: /保存|确定/ })
      .first()
      .click();
  await confirmReject();
  await expect(
    approverPage.locator(".el-message", { hasText: "驳回原因" }).first()
  ).toBeVisible({ timeout: 10_000 });
  await rejectDialog.locator("textarea").first().fill("E2E 驳回原因");
  await confirmReject();
  await expect(
    approverPage.locator(".el-table__row", { hasText: title })
  ).toHaveCount(0, { timeout: 20_000 });
  await approverContext.close();

  await page.reload();
  await openInstanceCenter(page);
  await page.getByRole("tab", { name: "我的申请" }).first().click();
  const finalRow = page.locator(".el-table__row", { hasText: title }).first();
  await expect(finalRow).toBeVisible({ timeout: 20_000 });
  await expect(finalRow).toContainText("已驳回", { timeout: 20_000 });
});

test("流程定义：列表可见 + 编辑配置抽屉展示节点", async ({ page }) => {
  await login(page);
  const token = await getAccessToken(page);
  const stamp = Date.now();
  const code = `e2e_def_${stamp}`;
  const flowName = `E2E流程-${code}`;
  await createFlow(page, token, code, [
    {
      name: "E2E节点A",
      order: 1,
      approve_type: "OR",
      assignee_type: "user",
      assignee_value: APPROVER.username
    }
  ]);

  await openMenuPath(page, ["系统管理"], FLOW_DEF_URL);
  const row = page.locator(".el-table__row", { hasText: flowName }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByRole("button", { name: "新增流程" }).first()
  ).toBeVisible();

  await row.getByRole("button", { name: "编辑配置" }).first().click();
  const drawer = page.locator(".el-drawer:visible").first();
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  await expect(drawer).toContainText("审批节点");
  await expect(drawer.locator("input").first()).toHaveValue(flowName);
  // 节点名在行内输入框中回显（文本断言取不到 input 的 value）
  await expect(
    drawer.locator(".el-table__row").last().locator("input").first()
  ).toHaveValue("E2E节点A");

  // 二期画布（ADR-016 §4）：切换到画布视图，节点卡渲染（含节点名与序号）
  await drawer
    .locator(".el-radio-button", { hasText: "画布视图" })
    .first()
    .click();
  await expect(drawer.locator(".vue-flow__node").first()).toBeVisible({
    timeout: 10_000
  });
  await expect(drawer.locator(".vue-flow__node").first()).toContainText(
    "E2E节点A"
  );
});
