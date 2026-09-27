import { expect, test } from "@playwright/test";

import { BACKEND_URL, getAccessToken, login, openMenuPath } from "./helpers";

/**
 * 报表设计器（P2.2 批次二）：
 * 素材走 API 直建（数据集 + 报表）→ 设计器套用「分组统计」模板（列 + 两个分组图表）
 * → 加指标卡并改标题 → 保存并读接口校验落库 → 明细表预览与组件实时渲染。
 *
 * 投递侧（xlsx 按设计裁剪列、组件独立 sheet）由 server 集成测试守护，
 * 浏览器侧只覆盖「设计 → 保存 → 落库」这条用户可见链路。
 */

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function postJson(
  page: Parameters<typeof getAccessToken>[0],
  url: string,
  token: string,
  data: object
) {
  const resp = await page.request.post(url, { headers: auth(token), data });
  const payload = await resp.json();
  expect(
    payload.code,
    `POST ${url} 失败：${JSON.stringify(payload).slice(0, 300)}`
  ).toBe(1000);
  return payload.data as Record<string, string>;
}

test("报表设计器：模板 → 组件 → 保存落库", async ({ page }) => {
  const suffix = Math.random().toString(36).slice(2, 8);
  const componentTitle = `E2E指标卡-${suffix}`;
  const reportName = `E2E设计报表-${suffix}`;

  await login(page);
  const token = await getAccessToken(page);

  const dataset = await postJson(
    page,
    `${BACKEND_URL}/api/dataset/datasets`,
    token,
    {
      name: `E2E设计数据集-${suffix}`,
      bound_model: "system.userinfo",
      columns: ["username", "gender", "is_active"],
      visibility: "shared"
    }
  );
  const report = await postJson(
    page,
    `${BACKEND_URL}/api/dataset/reports`,
    token,
    {
      name: reportName,
      dataset: dataset.pk,
      recipients: ["designer@example.com"],
      design: {}
    }
  );

  // ---- 进设计器 ----
  await openMenuPath(page, ["数据分析"], "/analysis/report/index");
  const row = page.getByRole("row", { name: reportName });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button", { name: "设计报表" }).click();
  await expect(page).toHaveURL(/\/analysis\/report\/designer/);
  await expect(page.getByTestId("designer-canvas")).toBeVisible({
    timeout: 15_000
  });

  // 明细表预览默认全列（设计为空 = 全部列）
  const table = page.getByTestId("report-table");
  await expect(table).toBeVisible({ timeout: 20_000 });
  await expect(
    table.getByRole("columnheader", { name: "username" })
  ).toBeVisible();

  // ---- 模板：分组统计 → 前 4 列 + 两个分组图表 ----
  await page.getByTestId("designer-template").click();
  await page
    .locator(".el-select-dropdown:visible .el-select-dropdown__item", {
      hasText: "分组统计"
    })
    .first()
    .click();
  const components = page.locator("[data-component-id]");
  await expect(components).toHaveCount(2, { timeout: 15_000 });
  await expect(
    page.locator('[data-component-type="bar"]').first()
  ).toBeVisible();
  await expect(
    page.locator('[data-component-type="pie"]').first()
  ).toBeVisible();

  // ---- 组件库：加指标卡并改标题（右侧属性面板）----
  await page.getByTestId("add-number").click();
  await expect(components).toHaveCount(3);
  await page.getByTestId("component-title").fill(componentTitle);
  await expect(
    page.locator(".designer-component__title", { hasText: componentTitle })
  ).toBeVisible();

  // ---- 保存：Toast + 未保存标记消失 ----
  await page.getByTestId("designer-save").click();
  await expect(page.getByText("设计已保存")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".designer-header .el-tag")).toHaveCount(0);

  // ---- 落库校验（读接口）----
  const saved = await page.request.get(
    `${BACKEND_URL}/api/dataset/reports/${report.pk}`,
    { headers: auth(token) }
  );
  const design = (await saved.json()).data.design as {
    columns: string[];
    table_limit: number;
    components: { type: string; title?: string; group_by?: string }[];
  };
  expect(design.columns.length).toBeGreaterThan(0);
  expect(design.components).toHaveLength(3);
  expect(design.components.map(item => item.type).sort()).toEqual([
    "bar",
    "number",
    "pie"
  ]);
  expect(design.components.find(item => item.type === "number")?.title).toBe(
    componentTitle
  );

  // ---- 刷新数据：明细表仍可渲染（执行接口按设计列裁剪）----
  await page.getByTestId("designer-refresh").click();
  await expect(
    table.getByRole("columnheader", { name: "username" })
  ).toBeVisible();

  // ---- 清理：API 删除报表（数据集保留）----
  await page.request
    .delete(`${BACKEND_URL}/api/dataset/reports/${report.pk}`, {
      headers: auth(token)
    })
    .catch(() => undefined);
});
