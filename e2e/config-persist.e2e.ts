import { expect, test } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 站点配置持久化 E2E（T4.3）：用户配置页新增配置项 → 刷新页面后仍然存在。
 * 用户配置页为 RePlusPage CRUD（key/value 行数据），新增行落库即验证持久化链路
 * （SysConfig/UserConfig 写库 + 缓存失效 + 列表回读）。
 */

test("用户配置：新增配置项 → 刷新后仍存在", async ({ page }) => {
  const key = `e2e_cfg_${Date.now()}`;
  await login(page);
  // 三级菜单：系统管理 → 配置管理 → 用户配置
  await openMenuPath(
    page,
    ["系统管理", "配置管理"],
    "/system/config/user/index"
  );
  const table = page.locator(".el-table").first();
  await expect(table).toBeVisible({ timeout: 15_000 });

  // 新增：用户ID（必填下拉，用户配置行必须归属用户）+ 配置名称（key）+ 配置数值（value）
  await page.getByRole("button", { name: "新增" }).first().click();
  const dialog = page.locator(".el-dialog, .el-drawer").first();
  await expect(dialog).toBeVisible();
  // RePlusPage 弹层首个 el-select 即必填的「用户ID」，点击后打开「用户选择器」
  // 弹层（api-search-user 组件：用户表格 + 确定，非 el-dialog 结构），勾选种子
  // 用户 e2e_user 后确定；缺此步前端校验不过，beforeSure 卡 loading 弹层不关闭
  await dialog.locator(".el-select").first().click();
  const pickerSearch = page.getByPlaceholder("请输入用户名");
  await pickerSearch.waitFor({ state: "visible", timeout: 15_000 });
  const pickerRow = page
    .locator(".el-table__row", { hasText: "e2e_user" })
    .last();
  await pickerRow.waitFor({ state: "visible", timeout: 15_000 });
  await pickerRow.locator(".el-checkbox").first().click();
  await page.getByRole("button", { name: "确定" }).last().click();
  // RePlusPage 弹层表单非 el-form-item 结构：按 placeholder 定位配置名称，
  // 「配置数值」无 placeholder，取弹层内第二个输入框（配置名称 → 配置数值 → 描述）
  const keyInput = dialog.getByPlaceholder("请输入配置名称").first();
  await keyInput.fill(key);
  // 配置数值为 JSON 编辑器（vanilla-jsoneditor/CodeMirror）：fill 不触发其状态
  // 同步，必须以真实键盘事件输入合法 JSON（纯文本会报 Unexpected token）；
  // 首次打开该页面时编辑器 chunk 懒加载较慢，需等其状态栏渲染完再输入
  await dialog
    .getByText(/Line: 1/)
    .first()
    .waitFor({
      state: "visible",
      timeout: 30_000
    });
  const valueEditor = dialog.getByRole("textbox").nth(1);
  await valueEditor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type('"e2e-value-1"');
  // 等编辑器 onChange → 表单模型同步完成（冷启动编译时同步可能延迟），
  // 否则保存被前端校验拦下且弹层 loading 永不复位
  await page.waitForTimeout(1_500);
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
