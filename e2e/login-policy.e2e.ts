import { expect, test } from "@playwright/test";

import { FRONT_URL, getAccessToken, login, openMenuPath } from "./helpers";

/**
 * 登录访问策略：元数据表单渲染与保存主链路。
 *
 * 钉住迁移后的页面级配置（元数据本身无法表达）：
 * - `weekdays`（JSONField）渲染为多选而非 JSON 编辑器；
 * - `ip_ranges`（TextField）渲染为 textarea；
 * - `start_time` / `end_time`（TimeField）渲染为 time-picker；
 * - `target_type` / `action` 新建态有默认选中项（LabeledChoiceField 的模型默认值），
 *   否则 required 规则会在打开弹窗即报错。
 *
 * 安全约束：来源网段填不可达 CIDR——无条件的「拒绝」策略默认会拒绝全部登录，一旦
 * 落库且清理被打断就会污染共享库。用例末尾按 pk 删除，双浏览器共享库下保持幂等。
 */
test("登录策略：元数据表单渲染与保存", async ({ page }) => {
  await login(page);
  const token = await getAccessToken(page);
  const headers = { Authorization: `Bearer ${token}` };
  const name = `E2E登录策略-${Date.now()}`;
  let pk = "";

  try {
    await openMenuPath(page, ["系统设置"], "/settings/login-policy/index");
    await page.getByRole("button", { name: "新增", exact: true }).click();
    const dialog = page.locator(".el-dialog:visible").first();
    const item = (label: string) =>
      dialog.locator(".el-form-item").filter({ hasText: label }).first();

    await expect(item("策略名称")).toBeVisible();
    await expect(item("生效星期").locator(".el-select")).toBeVisible();
    await expect(item("限制网段").locator("textarea")).toBeVisible();
    await expect(item("开始时间").locator("input")).toBeVisible();
    // 新建默认选中项
    await expect(item("目标对象")).toContainText("全部用户");
    await expect(item("命中动作")).toContainText("拒绝");

    // 安全阀：来源网段指向不可达地址——即使清理被打断，策略也不会拒绝真实登录
    // （无条件 + 拒绝 = 拒绝全部登录，属于该模型的高危默认组合）
    await item("限制网段").locator("textarea").fill("10.255.255.255/32");

    await item("策略名称").locator("input").fill(name);
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(page.locator(".el-message--success").first()).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible(
      {
        timeout: 15_000
      }
    );
  } finally {
    const listRes = await page.request.get(
      `${FRONT_URL}/api/identity/login-policies?name=${encodeURIComponent(name)}`,
      { headers }
    );
    pk = (await listRes.json())?.data?.results?.[0]?.pk ?? "";
    if (pk) {
      await page.request.delete(
        `${FRONT_URL}/api/identity/login-policies/${pk}`,
        { headers }
      );
    }
  }
});
