import { expect, test, type Page } from "@playwright/test";

import {
  APPROVER,
  BACKEND_URL,
  FRONT_URL,
  getAccessToken,
  login
} from "./helpers";

/**
 * 动态表单 × 审批流程：绑定流程的表单提交进入流程引擎（非操作审批），
 * 审批结果回写到提交状态，被驳回后可「重新提交」。
 *
 * 数据经 API 准备（流程 + 绑定表单），UI 侧验证：
 * 1. 新控件渲染（日期范围 / 明细子表增加行）；
 * 2. 提交后状态为「待审批」，且绑定流程的卡片带「流程审批」标记；
 * 3. 审批人驳回 → 申请人一键重新提交 → 状态回到「待审批」；
 * 4. 审批人通过 → 状态回写「已通过」。
 */

async function approverToken(page: Page): Promise<string> {
  const browser = page.context().browser();
  if (!browser) throw new Error("无法获取浏览器实例");
  const context = await browser.newContext({ locale: "zh-CN" });
  const approverPage = await context.newPage();
  try {
    await login(approverPage, APPROVER);
    return await getAccessToken(approverPage);
  } finally {
    await context.close();
  }
}

async function findInstance(page: Page, token: string, keyword: string) {
  const response = await page.request.get(
    `${BACKEND_URL}/api/system/approval-instances?page=1&size=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  expect(response.ok(), await response.text()).toBeTruthy();
  const rows = ((await response.json())?.data?.results ?? []) as Array<{
    title?: string;
    pk: string;
  }>;
  return rows.find(item => (item.title ?? "").includes(keyword));
}

test("表单绑定审批流程：提交进入流程 → 驳回重提 → 审批通过 → 状态回写", async ({
  page
}) => {
  await login(page);
  const token = await getAccessToken(page);
  const headers = { Authorization: `Bearer ${token}` };

  const suffix = Math.random().toString(36).slice(2, 8);
  const formName = `E2E入职-${suffix}`;
  let formPk = "";
  let flowPk = "";

  try {
    // ---- 准备：审批流程（单节点，审批人 = 第二超管） ----
    const flowRes = await page.request.post(
      `${BACKEND_URL}/api/system/approval-flows`,
      {
        headers,
        data: {
          name: `E2E入职流程-${suffix}`,
          code: `e2e_onboarding_${suffix}`,
          is_active: true,
          form_schema: [{ key: "days", label: "试用天数", type: "number" }],
          nodes: [
            {
              name: "人事确认",
              order: 1,
              approve_type: "OR",
              assignee_type: "user",
              assignee_value: APPROVER.username
            }
          ]
        }
      }
    );
    expect(flowRes.ok(), await flowRes.text()).toBeTruthy();
    flowPk = (await flowRes.json()).data.pk;

    // ---- 准备：表单绑定流程，含日期范围与明细子表控件 ----
    const formRes = await page.request.post(
      `${BACKEND_URL}/api/system/dynamic-forms`,
      {
        headers,
        data: {
          name: formName,
          is_active: true,
          approval_flow: flowPk,
          schema: {
            fields: [
              { key: "staff", label: "姓名", type: "input", required: true },
              { key: "period", label: "试用期", type: "daterange" },
              {
                key: "items",
                label: "教育经历",
                type: "table",
                columns: [
                  { key: "school", label: "学校", type: "input" },
                  { key: "year", label: "年份", type: "number" }
                ]
              }
            ]
          }
        }
      }
    );
    expect(formRes.ok(), await formRes.text()).toBeTruthy();
    formPk = (await formRes.json()).data.pk;

    // ---- 填报：新控件渲染 + 提交 ----
    await page.goto(`${FRONT_URL}/#/form-collection/my/index`);
    const card = page
      .getByTestId("fill-form-card")
      .filter({ hasText: formName });
    await expect(card).toBeVisible({ timeout: 15_000 });
    // 绑定流程的表单卡片标「流程审批」（区别于操作审批的「需审批」）
    await expect(card.getByTestId("fill-form-flow-tag")).toBeVisible();

    await card.click();
    const fillDialog = page.locator(".el-dialog");
    await expect(fillDialog).toBeVisible();
    await fillDialog.getByLabel("姓名").fill("E2E小明");
    // 明细子表：添加一行后填首列
    await fillDialog.getByTestId("dform-add-row").click();
    await fillDialog.locator(".el-table__row input").first().fill("示例大学");
    await fillDialog.getByRole("button", { name: "保存" }).click();
    await expect(fillDialog).not.toBeVisible();

    const row = page
      .getByTestId("my-submission-table")
      .getByRole("row", { name: formName });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByTestId("submission-status-tag")).toHaveText("待审批");

    // ---- 审批人驳回 ----
    const approverHeaders = {
      Authorization: `Bearer ${await approverToken(page)}`
    };
    let instance = await findInstance(
      page,
      approverHeaders.Authorization.split(" ")[1],
      formName
    );
    expect(instance, "绑定流程的表单提交应生成流程实例").toBeTruthy();
    if (!instance) throw new Error("绑定流程的表单提交未生成流程实例");
    const rejectRes = await page.request.post(
      `${BACKEND_URL}/api/system/approval-instances/${instance.pk}/reject`,
      { headers: approverHeaders, data: { reason: "E2E 材料不齐" } }
    );
    expect(rejectRes.ok(), await rejectRes.text()).toBeTruthy();

    await page.reload();
    await expect(
      page
        .getByTestId("my-submission-table")
        .getByRole("row", { name: formName })
        .getByTestId("submission-status-tag")
    ).toHaveText("已驳回");

    // ---- 申请人一键重新提交 ----
    await page
      .getByTestId("my-submission-table")
      .getByRole("row", { name: formName })
      .getByTestId("submission-resubmit")
      .click();
    await expect(
      page
        .getByTestId("my-submission-table")
        .getByRole("row", { name: formName })
        .getByTestId("submission-status-tag")
    ).toHaveText("待审批", { timeout: 15_000 });

    // ---- 审批人通过 → 状态回写 ----
    instance = await findInstance(
      page,
      approverHeaders.Authorization.split(" ")[1],
      formName
    );
    if (!instance) throw new Error("重新提交后未生成流程实例");
    const approveRes = await page.request.post(
      `${BACKEND_URL}/api/system/approval-instances/${instance.pk}/approve`,
      { headers: approverHeaders, data: { reason: "E2E 同意" } }
    );
    expect(approveRes.ok(), await approveRes.text()).toBeTruthy();

    await page.reload();
    await expect(
      page
        .getByTestId("my-submission-table")
        .getByRole("row", { name: formName })
        .getByTestId("submission-status-tag")
    ).toHaveText("已通过", { timeout: 15_000 });
  } finally {
    if (formPk) {
      await page.request
        .delete(`${BACKEND_URL}/api/system/dynamic-forms/${formPk}`, {
          headers
        })
        .catch(() => undefined);
    }
    if (flowPk) {
      await page.request
        .delete(`${BACKEND_URL}/api/system/approval-flows/${flowPk}`, {
          headers
        })
        .catch(() => undefined);
    }
  }
});
