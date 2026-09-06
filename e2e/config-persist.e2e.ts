import { expect, test } from "@playwright/test";

import { login, openMenu } from "./helpers";

/**
 * 站点配置持久化 E2E（T4.3）：用户配置页新增配置项 → 刷新页面后仍然存在。
 * 用户配置页为 RePlusPage CRUD（key/value 行数据），新增行落库即验证持久化链路
 * （SysConfig/UserConfig 写库 + 缓存失效 + 列表回读）。
 */

test("用户配置：新增配置项 → 刷新后仍存在", async ({ page }) => {
  const key = `e2e_cfg_${Date.now()}`;
  await login(page);
  await openMenu(page, "系统管理", "用户配置");
  const table = page.locator(".el-table").first();
  await expect(table).toBeVisible({ timeout: 15_000 });

  // 新增：配置名称（key）+ 配置数值（value）
  await page.getByRole("button", { name: "新增" }).first().click();
  const dialog = page.locator(".el-dialog, .el-drawer").first();
  await expect(dialog).toBeVisible();
  const keyInput = dialog
    .locator(".el-form-item:has-text('配置名称') input")
    .first();
  await keyInput.fill(key);
  const valueInput = dialog
    .locator(
      ".el-form-item:has-text('配置数值') input, .el-form-item:has-text('配置数值') textarea"
    )
    .first();
  await valueInput.fill("e2e-value-1");
  await dialog
    .getByRole("button", { name: /保存|确定/ })
    .first()
    .click();
  await expect(dialog).not.toBeVisible({ timeout: 15_000 });

  await expect(
    page.locator(".el-table__row", { hasText: key }).first()
  ).toBeVisible({ timeout: 15_000 });

  // 刷新页面：数据从后端重新加载，配置项必须仍在（持久化而非仅前端状态）
  await page.reload();
  const tableAfter = page.locator(".el-table").first();
  await expect(tableAfter).toBeVisible({ timeout: 15_000 });
  await expect(
    page.locator(".el-table__row", { hasText: key }).first()
  ).toBeVisible({
    timeout: 15_000
  });
});
