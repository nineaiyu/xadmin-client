import { expect, test } from "@playwright/test";

import { FRONT_URL, login, openMenuPath } from "./helpers";

/**
 * 数据脱敏规则：创建规则 → 管理页可见 → 预览弹窗实时得到掩码结果 → 删除。
 * 说明：列表展示的实际掩码效果依赖非超管 + 字段权限组合，已由后端单测
 * （tests/unit/system/test_data_mask.py 的 TestSerializerMasking）保障，
 * E2E 聚焦规则管理与预览交互链路。
 */
test("脱敏规则：创建、列表展示、预览弹窗与删除", async ({ page }) => {
  await login(page);

  const model = "system.userinfo";
  // 用不存在的字段名建规则：只验证管理/预览链路，不影响真实用户数据展示
  const field = `phone_${Date.now()}`;
  const createResp = await page.request.post(
    `${FRONT_URL}/api/system/mask-rules`,
    {
      data: {
        model,
        field,
        mask_type: "phone",
        // 与下方预览弹窗默认保留位数（3/2）保持一致，避免两处口径不一致造成误读
        keep_head: 3,
        keep_tail: 2,
        is_active: true,
        description: "E2E脱敏规则"
      }
    }
  );
  const payload = await createResp.json();
  expect(payload.code, `create rule: ${JSON.stringify(payload)}`).toBe(1000);
  const pk = payload.data.pk;

  // 打开脱敏规则页：规则行可见
  await openMenuPath(page, ["系统管理"], "/system/mask/index");
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });
  await expect(
    page.locator(".el-table__row", { hasText: field }).first()
  ).toBeVisible();

  // 工具栏「脱敏预览」按钮 → 弹窗录入样例值 → 预览返回掩码结果
  await page.getByRole("button", { name: "脱敏预览" }).first().click();
  const dialog = page.locator(".el-dialog:visible").first();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog
    .locator(".el-form-item:has-text('样例值') input")
    .first()
    .fill("13812345678");
  await dialog.getByRole("button", { name: "预览" }).click();
  // 预览弹窗未填保留位数时用表单默认值 keep_head=3 / keep_tail=2 → 138******78
  await expect(
    dialog.locator(".el-alert", { hasText: "138******78" }).first()
  ).toBeVisible({ timeout: 15_000 });

  // 关闭弹窗并删除规则；删除后刷新页面确保表格不再展示该行
  await page.keyboard.press("Escape");
  const delResp = await page.request.delete(
    `${FRONT_URL}/api/system/mask-rules/${pk}`
  );
  expect((await delResp.json()).code, "delete rule").toBe(1000);
  await page.reload();
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });
  await expect(page.locator(".el-table__row", { hasText: field })).toHaveCount(
    0
  );
});
