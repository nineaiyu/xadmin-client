import { expect, test } from "@playwright/test";

import { FRONT_URL, getAccessToken, login, openMenuPath } from "./helpers";

/**
 * 数据集 JSON 路径列（ADR-069）：设计器手工输入 `字段.键`（含 `|number` 标注）→
 * 保存 → 执行预览出现动态列与实际值（数据源为表单提交的 JSON 数据）。
 *
 * 素材走 API（表单定义 + 两条提交）；数据集名带随机后缀并在末尾清理
 * （双浏览器共享库幂等，同 analysis.e2e.ts 口径）。
 */
test("数据集 JSON 路径列：设计器输入 → 保存 → 预览出列", async ({ page }) => {
  await login(page);
  const token = await getAccessToken(page);
  const headers = { Authorization: `Bearer ${token}` };
  const suffix = Math.random().toString(36).slice(2, 8);
  const formName = `E2E-JSON列-${suffix}`;
  const datasetName = `E2E-JSON数据集-${suffix}`;

  const formRes = await page.request.post(
    `${FRONT_URL}/api/dataset/dynamic-forms`,
    {
      headers,
      data: {
        name: formName,
        is_active: true,
        schema: {
          fields: [
            {
              key: "kind",
              label: "类别",
              type: "select",
              options: ["甲", "乙"]
            },
            { key: "amount", label: "数量", type: "number" },
            { key: "deadline", label: "截止日", type: "date" }
          ]
        }
      }
    }
  );
  expect(formRes.ok(), await formRes.text()).toBeTruthy();
  const formPk = (await formRes.json()).data.pk;
  for (const data of [
    { kind: "甲", amount: 3, deadline: "2026-09-01" },
    { kind: "乙", amount: 10, deadline: "2026-10-05" }
  ]) {
    const filled = await page.request.post(
      `${FRONT_URL}/api/dataset/dynamic-form-submissions`,
      { headers, data: { form: formPk, data } }
    );
    expect(filled.ok(), await filled.text()).toBeTruthy();
  }

  try {
    await openMenuPath(page, ["数据分析"], "/analysis/dataset/index");
    await page.getByRole("button", { name: "新建数据集" }).click();
    const dialog = page.locator(".el-dialog").filter({ hasText: "新建数据集" });
    await dialog.getByLabel("名称").fill(datasetName);

    await dialog
      .locator(".el-form-item:has-text('绑定模型') .el-select")
      .first()
      .click();
    await page
      .locator(".el-select-dropdown:visible .el-select-dropdown__item", {
        hasText: "dataset.dynamicformsubmission"
      })
      .first()
      .click();

    // 数据列：allow-create 手工输入 JSON 路径（Enter 创建选项）
    const columnsSelect = dialog
      .locator(".el-form-item:has-text('数据列') .el-select")
      .first();
    await columnsSelect.click();
    const columnsInput = columnsSelect.locator("input").first();
    await columnsInput.fill("data.kind");
    await columnsInput.press("Enter");
    await columnsInput.fill("data.amount|number");
    await columnsInput.press("Enter");
    await columnsInput.fill("data.deadline|date");
    await columnsInput.press("Enter");
    await dialog.locator(".el-dialog__header").click();
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(dialog).not.toBeVisible();

    // 执行预览：列名 = 列声明（含类型后缀），值取自 JSON
    const row = page.getByRole("row", { name: datasetName });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole("button", { name: "执行预览" }).click();
    const previewDialog = page
      .locator(".el-dialog")
      .filter({ hasText: "执行预览" });
    await expect(previewDialog).toBeVisible();
    await expect(
      previewDialog.getByRole("columnheader", { name: "data.kind" })
    ).toBeVisible();
    await expect(
      previewDialog.getByRole("columnheader", { name: "data.amount|number" })
    ).toBeVisible();
    await expect(
      previewDialog.getByRole("columnheader", { name: "data.deadline|date" })
    ).toBeVisible();
    await expect(previewDialog.getByRole("row", { name: /乙/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(previewDialog).not.toBeVisible();
  } finally {
    const listResp = await page.request.get(
      `${FRONT_URL}/api/dataset/datasets?name=${encodeURIComponent(datasetName)}&size=50`,
      { headers }
    );
    const datasets = (await listResp.json())?.data?.results ?? [];
    for (const item of datasets) {
      await page.request
        .delete(`${FRONT_URL}/api/dataset/datasets/${item.pk}`, { headers })
        .catch(() => undefined);
    }
    await page.request
      .delete(`${FRONT_URL}/api/dataset/dynamic-forms/${formPk}`, { headers })
      .catch(() => undefined);
  }
});
