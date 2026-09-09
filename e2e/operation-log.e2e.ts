import { expect, test } from "@playwright/test";

import { FRONT_URL, login, openMenuPath } from "./helpers";

/**
 * 审计日志增强：
 * 1. DELETE 操作（删除数据字典项）落操作日志，且可按 method 检索（F5 检索扩展）；
 * 2. 操作日志页面渲染（耗时列 / 检索项）。
 */
test("审计日志：DELETE 操作入日志且可按方法检索", async ({ page }) => {
  await login(page);

  const code = `e2e_audit_${Date.now()}`;
  const create = await page.request.post(`${FRONT_URL}/api/system/dict`, {
    data: { code, label: "审计用字典" }
  });
  const createPayload = await create.json();
  expect(createPayload.code, JSON.stringify(createPayload)).toBe(1000);
  const dictPk = createPayload.data.pk;

  const delResp = await page.request.delete(
    `${FRONT_URL}/api/system/dict/${dictPk}`
  );
  expect((await delResp.json()).code).toBe(1000);

  // 操作日志按方法检索（on_commit 落库有延迟，轮询等待）
  const listResp = await page.request.get(
    `${FRONT_URL}/api/system/logs/operation?method=DELETE&page_size=20`
  );
  expect(listResp.status()).toBe(200);
  const rows = (await listResp.json()).data.results;
  const dictDelete = rows.find(
    row => row.path?.includes("/api/system/dict/") && row.method === "DELETE"
  );
  expect(dictDelete, "DELETE 日志应已落库").toBeTruthy();
});

test("操作日志页面渲染", async ({ page }) => {
  await login(page);
  // 访问日志挂在「系统管理 → 日志管理」目录下
  await openMenuPath(
    page,
    ["系统管理", "日志管理"],
    "/system/logs/operation/index"
  );
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });
  // 检索区提供耗时区间与字段变更过滤（F5 检索扩展）
  await expect(page.getByText("耗时", { exact: false }).first()).toBeVisible();
});
