import { expect, test, type Page } from "@playwright/test";

import { BACKEND_URL, FRONT_URL, getAccessToken, login } from "./helpers";

/**
 * 动态表单公式字段用例：
 *
 * 1. 设计器：新增字段 → 属性弹窗选「公式计算」→ 填表达式（引用数值字段）
 *    → 保存（落库 type=formula + 表达式）；
 * 2. 填报页：填写引用字段 → 只读计算值实时更新（12.00）→ 提交成功；
 * 3. 服务端重算：提交落库的公式值由服务端按当前数据重算（与前端展示一致）。
 *
 * 数据准备与清理走 API（page.request 携 token）；UI 侧只验证交互与展示。
 */

const headers = (token: string) => ({ Authorization: `Bearer ${token}` });

async function createForm(
  page: Page,
  token: string,
  data: Record<string, unknown>
): Promise<string> {
  const res = await page.request.post(
    `${BACKEND_URL}/api/dataset/dynamic-forms`,
    { headers: headers(token), data }
  );
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).data.pk as string;
}

async function removeForm(page: Page, token: string, pk: string) {
  if (!pk) return;
  await page.request
    .delete(`${BACKEND_URL}/api/dataset/dynamic-forms/${pk}`, {
      headers: headers(token)
    })
    .catch(() => undefined);
}

async function openDesigner(page: Page, formName: string) {
  await page.goto(`${FRONT_URL}/#/form-collection/designer/index`);
  const row = page.getByRole("row", { name: formName });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button", { name: "编辑" }).click();
  const dialog = page.locator(".el-dialog").last();
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  return dialog;
}

test("表单公式：设计器配置 → 填报实时计算 → 服务端重算落库", async ({
  page
}) => {
  await login(page);
  const token = await getAccessToken(page);
  const suffix = Math.random().toString(36).slice(2, 8);
  const formName = `E2E公式-${suffix}`;
  let formPk = "";

  try {
    // 引用字段走 API 预置（用例聚焦公式字段的配置与求值）
    formPk = await createForm(page, token, {
      name: formName,
      is_active: true,
      schema: {
        fields: [
          { key: "qty", label: "数量", type: "number" },
          { key: "price", label: "单价", type: "number" }
        ]
      }
    });

    // ---- 设计器：新增公式字段 ----
    const dialog = await openDesigner(page, formName);
    await dialog.getByRole("button", { name: "添加字段" }).click();
    const rows = dialog.locator(".el-table__row");
    await expect(rows).toHaveCount(3);
    await rows.nth(2).locator("input").nth(1).fill("合计");
    await rows.nth(2).getByTestId("field-props").click();

    const propDialog = page.locator(".el-dialog").last();
    await expect(propDialog.getByTestId("field-prop-key")).toBeVisible();
    // 类型切换为「公式计算」（属性弹窗内的类型选择器）
    await propDialog.locator(".el-select").first().click();
    await page
      .locator(".el-select-dropdown__item")
      .filter({ hasText: "公式计算", visible: true })
      .first()
      .click();
    await propDialog.locator(".el-dialog__header").click();
    // 表达式 + 引用标签（数值字段与公式字段都可插入）
    // ElInput 把 data-testid 透传到内部 textarea 元素本身（inheritAttrs:false）
    await propDialog.getByTestId("field-prop-formula").fill("{qty} * {price}");
    await expect(
      propDialog.getByTestId("field-prop-formula-refs")
    ).toContainText("{qty}");
    await propDialog.getByRole("button", { name: "保存" }).click();
    // .el-dialog 的 last() 在闭幕后会回到设计器弹窗：按属性弹窗内元素判消失
    await expect(page.getByTestId("field-prop-formula")).toBeHidden({
      timeout: 10_000
    });

    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    // 落库校验：字段类型与表达式
    const detail = await page.request.get(
      `${BACKEND_URL}/api/dataset/dynamic-forms/${formPk}`,
      { headers: headers(token) }
    );
    const fields = (await detail.json())?.data?.schema?.fields ?? [];
    const formula = fields.find(
      (item: { type: string }) => item.type === "formula"
    );
    expect(formula?.formula).toBe("{qty} * {price}");

    // ---- 填报页：实时计算与提交 ----
    await page.goto(`${FRONT_URL}/#/form-collection/my/index`);
    const card = page
      .getByTestId("fill-form-card")
      .filter({ hasText: formName });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();
    const fillDialog = page.locator(".el-dialog").last();
    await expect(fillDialog).toBeVisible({ timeout: 10_000 });
    const item = (label: string) =>
      fillDialog.locator(".el-form-item").filter({ hasText: label });
    const formulaValue = fillDialog.getByTestId("dform-formula-value");

    // 未填引用字段：公式为空占位
    await expect(formulaValue).toHaveText("—");

    await item("数量").locator("input").fill("3");
    await item("单价").locator("input").fill("4");
    // 只读计算值随输入实时更新（3 × 4 = 12.00）
    await expect(formulaValue).toHaveText("12.00");

    await fillDialog.getByRole("button", { name: "保存" }).click();
    await expect(fillDialog).not.toBeVisible({ timeout: 10_000 });
    await expect(
      page
        .getByTestId("my-submission-table")
        .getByRole("row", { name: formName })
    ).toBeVisible({ timeout: 15_000 });

    // 服务端重算落库：提交数据中的公式值为 12（客户端提交值不参与落库）
    const submissions = await page.request.get(
      `${BACKEND_URL}/api/dataset/form-data?form=${formPk}`,
      { headers: headers(token) }
    );
    const results = (await submissions.json())?.data?.results ?? [];
    const rowData: Record<string, unknown> = results[0]?.data ?? {};
    const formulaEntry = Object.entries(rowData).find(
      ([key]) => key !== "qty" && key !== "price"
    );
    expect(formulaEntry, JSON.stringify(rowData)).toBeTruthy();
    expect(Number(formulaEntry?.[1])).toBe(12);
  } finally {
    await removeForm(page, token, formPk);
  }
});
