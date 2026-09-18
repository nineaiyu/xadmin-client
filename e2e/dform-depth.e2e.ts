import { expect, test, type Page } from "@playwright/test";

import { BACKEND_URL, FRONT_URL, getAccessToken, login } from "./helpers";

/**
 * 表单采集深度用例（设计器能力 + 填报闭环）：
 *
 * 1. 设计器字段排序与属性编辑（placeholder 等校验属性）真实落库到 schema；
 * 2. 模板：行内「存为模板」→「从模板新建」预填设计器 → 保存出新表单；
 * 3. 我的填报：数据字典字段（选项来自字典）→ 保存草稿 → 提交 → 详情抽屉展示。
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
    `${BACKEND_URL}/api/system/dynamic-forms`,
    {
      headers: headers(token),
      data
    }
  );
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).data.pk as string;
}

async function removeForm(page: Page, token: string, pk: string) {
  if (!pk) return;
  await page.request
    .delete(`${BACKEND_URL}/api/system/dynamic-forms/${pk}`, {
      headers: headers(token)
    })
    .catch(() => undefined);
}

/** 打开设计器「编辑」弹窗（ReDialog 为页面最后一个 .el-dialog） */
async function openDesigner(page: Page, formName: string) {
  await page.goto(`${FRONT_URL}/#/form-collection/designer/index`);
  const row = page.getByRole("row", { name: formName });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button", { name: "编辑" }).click();
  const dialog = page.locator(".el-dialog").last();
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  return dialog;
}

test("表单设计器：字段排序与属性编辑落库", async ({ page }) => {
  await login(page);
  const token = await getAccessToken(page);
  const suffix = Math.random().toString(36).slice(2, 8);
  const formName = `E2E设计-${suffix}`;
  let formPk = "";

  try {
    formPk = await createForm(page, token, {
      name: formName,
      is_active: true,
      schema: {
        fields: [
          { key: "field_a", label: "字段A", type: "input" },
          { key: "field_b", label: "字段B", type: "input" }
        ]
      }
    });

    const dialog = await openDesigner(page, formName);
    const rows = dialog.locator(".el-table__row");
    const labelOf = (index: number) => rows.nth(index).locator("input").nth(1);

    await expect(labelOf(0)).toHaveValue("字段A");
    // 下移首行：字段顺序互换（保存后即为渲染顺序）
    await rows.nth(0).getByTestId("field-move-down").click();
    await expect(labelOf(0)).toHaveValue("字段B");
    await expect(labelOf(1)).toHaveValue("字段A");

    // 属性弹窗：改标签 + 填占位提示（列表行内没有的校验/展示属性入口）
    await rows.nth(0).getByTestId("field-props").click();
    const propsDialog = page.locator(".el-dialog").last();
    await expect(propsDialog.getByTestId("field-prop-label")).toBeVisible();
    await propsDialog.getByTestId("field-prop-label").fill("字段B改");
    await propsDialog.getByTestId("field-prop-placeholder").fill("请填写字段B");
    await propsDialog.getByRole("button", { name: "保存" }).click();
    // 断言弹窗内容消失（.last() 会随弹窗关闭重绑定到父弹窗，不能用它对 not.toBeVisible）
    await expect(page.getByTestId("field-prop-placeholder")).not.toBeVisible();

    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(dialog).not.toBeVisible();

    // 落库校验：顺序 + 属性（以服务端 schema 为准）
    const detail = await page.request.get(
      `${BACKEND_URL}/api/system/dynamic-forms/${formPk}`,
      { headers: headers(token) }
    );
    const fields = (await detail.json())?.data?.schema?.fields ?? [];
    expect(fields.map((item: { key: string }) => item.key)).toEqual([
      "field_b",
      "field_a"
    ]);
    expect(fields[0].label).toBe("字段B改");
    expect(fields[0].placeholder).toBe("请填写字段B");
  } finally {
    await removeForm(page, token, formPk);
  }
});

test("表单模板：存为模板 → 从模板新建 → 新表单可填报", async ({ page }) => {
  await login(page);
  const token = await getAccessToken(page);
  const suffix = Math.random().toString(36).slice(2, 8);
  const formName = `E2E模板源-${suffix}`;
  const templateName = `E2E模板-${suffix}`;
  const copyName = `${templateName}（副本）`;
  let formPk = "";
  let copyPk = "";
  let templatePk = "";

  try {
    formPk = await createForm(page, token, {
      name: formName,
      is_active: true,
      schema: {
        fields: [
          { key: "staff", label: "姓名", type: "input", required: true },
          { key: "dept", label: "部门", type: "input" }
        ]
      }
    });

    await page.goto(`${FRONT_URL}/#/form-collection/designer/index`);
    const row = page.getByRole("row", { name: formName });
    await expect(row).toBeVisible({ timeout: 15_000 });

    // 行内「存为模板」：输入模板名（重名保护依靠 name 全局唯一）
    await row.getByRole("button", { name: "存为模板" }).click();
    const prompt = page.locator(".el-message-box");
    await expect(prompt).toBeVisible();
    await prompt.locator("input").fill(templateName);
    await prompt.getByRole("button", { name: "确定" }).click();
    await expect(prompt).not.toBeVisible();

    // 工具栏「从模板新建」→ 使用模板 → 设计器预填 2 个字段
    await page.getByRole("button", { name: "从模板新建" }).click();
    const picker = page.locator(".el-dialog").last();
    const templateRow = picker.getByRole("row", { name: templateName });
    await expect(templateRow).toBeVisible({ timeout: 10_000 });
    await templateRow.getByTestId("template-use").click();

    const designer = page.locator(".el-dialog").last();
    await expect(designer.locator(".el-table__row")).toHaveCount(2);
    await expect(designer.locator(".el-form-item input").first()).toHaveValue(
      copyName
    );
    await designer.getByRole("button", { name: "保存" }).click();
    await expect(designer).not.toBeVisible();

    // 新表单出现在列表（模板与表单分列：模板仅在 kind=templates 列表可见）
    await page.reload();
    await expect(page.getByRole("row", { name: copyName })).toBeVisible({
      timeout: 15_000
    });

    // 清理前记录副本与模板主键
    const listRes = await page.request.get(
      `${BACKEND_URL}/api/system/dynamic-forms?page=1&size=100`,
      { headers: headers(token) }
    );
    const rows = (await listRes.json())?.data?.results ?? [];
    copyPk =
      rows.find((item: { name: string }) => item.name === copyName)?.pk ?? "";
    const templateRes = await page.request.get(
      `${BACKEND_URL}/api/system/dynamic-forms?kind=templates&page=1&size=100`,
      { headers: headers(token) }
    );
    const templates = (await templateRes.json())?.data?.results ?? [];
    templatePk =
      templates.find((item: { name: string }) => item.name === templateName)
        ?.pk ?? "";
    expect(copyPk, "副本表单应已创建").toBeTruthy();
    expect(templatePk, "模板应已创建").toBeTruthy();
  } finally {
    await removeForm(page, token, copyPk);
    await removeForm(page, token, templatePk);
    await removeForm(page, token, formPk);
  }
});

test("我的填报：数据字典字段 + 草稿保存/提交 + 详情展示", async ({ page }) => {
  await login(page);
  const token = await getAccessToken(page);
  const suffix = Math.random().toString(36).slice(2, 8);
  const formName = `E2E字典填报-${suffix}`;
  const dictCode = `e2e_ddrop_${suffix}`;
  let formPk = "";
  let dictTypePk = "";
  const dictItemPks: string[] = [];

  try {
    // 字典类型 + 两个字典项（选项由数据字典维护）
    const typeRes = await page.request.post(`${BACKEND_URL}/api/system/dict`, {
      headers: headers(token),
      data: { code: dictCode, label: `E2E紧急度-${suffix}`, sort: 1 }
    });
    expect(typeRes.ok(), await typeRes.text()).toBeTruthy();
    dictTypePk = (await typeRes.json()).data.pk;
    for (const [code, label, value] of [
      ["high", "高", "high"],
      ["low", "低", "low"]
    ]) {
      const itemRes = await page.request.post(
        `${BACKEND_URL}/api/system/dict`,
        {
          headers: headers(token),
          data: {
            parent: dictTypePk,
            code,
            label,
            value,
            sort: code === "high" ? 1 : 2
          }
        }
      );
      expect(itemRes.ok(), await itemRes.text()).toBeTruthy();
      dictItemPks.push((await itemRes.json()).data.pk);
    }

    formPk = await createForm(page, token, {
      name: formName,
      is_active: true,
      schema: {
        fields: [
          {
            key: "priority",
            label: "优先级",
            type: "select",
            dict: dictCode,
            required: true
          },
          { key: "note", label: "备注", type: "input" }
        ]
      }
    });

    // 填报：字典选项按 label 渲染、提交值为字典 value
    await page.goto(`${FRONT_URL}/#/form-collection/my/index`);
    const card = page
      .getByTestId("fill-form-card")
      .filter({ hasText: formName });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();

    const dialog = page.locator(".el-dialog").last();
    await expect(dialog).toBeVisible();
    const priorityItem = dialog
      .locator(".el-form-item")
      .filter({ hasText: "优先级" });
    await priorityItem.locator(".el-select").click();
    const option = page
      .locator(".el-select-dropdown__item")
      .filter({ hasText: /^高$/ })
      .first();
    await expect(option).toBeVisible({ timeout: 10_000 });
    await option.click();
    // EP 下拉选中后常以可见态残留并遮挡后续输入：点弹窗标题强制收起
    await dialog.locator(".el-dialog__header").click();
    await dialog
      .locator(".el-form-item")
      .filter({ hasText: "备注" })
      .locator("input")
      .fill("E2E备注");

    // 保存草稿（未触发审批；列表出现「草稿」状态）
    await dialog.getByTestId("submission-save-draft").click();
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
    const row = page
      .getByTestId("my-submission-table")
      .getByRole("row", { name: formName });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByTestId("submission-status-tag")).toHaveText("草稿");

    // 提交草稿：严格校验通过后直接生效（状态标签消失）
    await row.getByTestId("submission-submit-draft").click();
    await expect(row.getByTestId("submission-status-tag")).toHaveCount(0, {
      timeout: 15_000
    });

    // 详情抽屉：字段按 schema 渲染，字典值回显 label
    await row.getByTestId("submission-detail").click();
    const detail = page.getByTestId("submission-detail-drawer");
    await expect(detail).toBeVisible({ timeout: 10_000 });
    await expect(detail).toContainText("高");
    await expect(detail).toContainText("E2E备注");
  } finally {
    if (formPk) await removeForm(page, token, formPk);
    for (const pk of dictItemPks) {
      await page.request
        .delete(`${BACKEND_URL}/api/system/dict/${pk}`, {
          headers: headers(token)
        })
        .catch(() => undefined);
    }
    if (dictTypePk) {
      await page.request
        .delete(`${BACKEND_URL}/api/system/dict/${dictTypePk}`, {
          headers: headers(token)
        })
        .catch(() => undefined);
    }
  }
});
