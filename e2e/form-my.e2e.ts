import { expect, test } from "@playwright/test";

import { BACKEND_URL, FRONT_URL, getAccessToken, login } from "./helpers";

/**
 * 我的填报：列表迁移 RePlusPage 后的形态回归。
 *
 * 覆盖：
 * - 卡片填报 → 提交入库（沿用既有填报链路）；
 * - 框架接管的列表：词条表头（表单 / 提交内容）、分页器、工具栏导出按钮；
 * - 行内「详情」抽屉（保留原 testid 契约）。
 *
 * 表单经 API 准备并在用例末尾删除（双浏览器共享库，避免残留）。
 */
test("我的填报：卡片填报 → 框架列表 → 详情抽屉", async ({ page }) => {
  await login(page);
  const token = await getAccessToken(page);
  const headers = { Authorization: `Bearer ${token}` };
  const suffix = Math.random().toString(36).slice(2, 8);
  const formName = `E2E列表-${suffix}`;
  let formPk = "";

  try {
    const formRes = await page.request.post(
      `${BACKEND_URL}/api/system/dynamic-forms`,
      {
        headers,
        data: {
          name: formName,
          is_active: true,
          schema: {
            fields: [
              { key: "title", label: "标题", type: "input", required: true }
            ]
          }
        }
      }
    );
    expect(formRes.ok(), await formRes.text()).toBeTruthy();
    formPk = (await formRes.json()).data.pk;

    // ---- 卡片填报 ----
    await page.goto(`${FRONT_URL}/#/form-collection/my/index`);
    const card = page
      .getByTestId("fill-form-card")
      .filter({ hasText: formName });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();
    const dialog = page.locator(".el-dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("标题").fill("E2E 列表迁移");
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(dialog).not.toBeVisible();

    // ---- 列表：框架接管（表头词条 / 分页 / 工具栏导出）----
    const tableArea = page.getByTestId("my-submission-table");
    await expect(
      tableArea.getByRole("columnheader", { name: "表单" }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      tableArea.getByRole("columnheader", { name: "提交内容" }).first()
    ).toBeVisible();
    await expect(tableArea.locator(".el-pagination")).toBeVisible();
    // 工具栏：框架默认按钮（导出/刷新/密度/列设置）随权限渲染
    await expect(tableArea.getByRole("img", { name: "列设置" })).toBeVisible();
    // 搜索区由框架按 search-columns 生成（提交人列已按个人页语义隐藏）
    await expect(
      tableArea.getByRole("button", { name: "搜索" }).first()
    ).toBeVisible();

    // ---- 行：本表单的提交可见，提交内容按 `key: value` 展示 ----
    const row = tableArea.getByRole("row", { name: formName });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText("title: E2E 列表迁移")).toBeVisible();
    await expect(row.getByText("无需审批")).toBeVisible();

    // ---- 详情抽屉（只读）----
    await row.getByTestId("submission-detail").click();
    const detail = page.getByTestId("submission-detail-drawer");
    await expect(detail).toBeVisible({ timeout: 10_000 });
    await expect(detail).toContainText("E2E 列表迁移");
    await page.keyboard.press("Escape");
    await expect(detail).not.toBeVisible();
  } finally {
    if (formPk) {
      await page.request
        .delete(`${BACKEND_URL}/api/system/dynamic-forms/${formPk}`, {
          headers
        })
        .catch(() => undefined);
    }
  }
});
