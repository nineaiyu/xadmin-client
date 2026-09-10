import { expect, test } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 站点配置持久化 E2E：用户配置页新增配置项 → 刷新页面后仍然存在。
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
  // 选择器内的用户表格是页面最后一个表格，先等它加载出行；列表默认
  // ordering=-created_time + pageSize=15，早建的 e2e_user 可能已被挤出首页 —
  // 此时退化为选择首行（本用例只要求「配置绑定到某个用户」，不关心是哪一个）
  const pickerTable = page.locator(".el-table").last();
  await pickerTable
    .locator(".el-table__row")
    .first()
    .waitFor({ state: "visible", timeout: 15_000 });
  const preferredRow = pickerTable
    .locator(".el-table__row", { hasText: "e2e_user" })
    .last();
  const pickerRow = (await preferredRow.count())
    ? preferredRow
    : pickerTable.locator(".el-table__row").first();
  // 列表 loading 与残留下拉浮层会拦截点击（webkit 曾表现为
  // 「.el-select-dropdown__empty / .el-loading-mask intercepts pointer events」）
  await page
    .locator(".el-loading-mask:visible")
    .first()
    .waitFor({ state: "hidden", timeout: 15_000 })
    .catch(() => undefined);
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
  // 编辑器 onChange → 表单模型同步存在延迟（冷启动编译更明显）；未同步时点保存会被前端
  // 校验拦下（出现 is-error 行内报错）且弹层 loading 不复位。
  // 不以固定 1.5s 延时等待，改为两个真实状态竞速（web-first）：
  // 「保存成功 → 弹层关闭」与「被校验拦下 → 行内报错出现」；仅后者才补点，成功路径不会重复提交。
  const saveBtn = dialog.getByRole("button", { name: /保存|确定/ }).first();
  for (let attempt = 0; attempt < 3; attempt++) {
    await saveBtn.click();
    const outcome = await Promise.race([
      dialog.waitFor({ state: "hidden", timeout: 15_000 }).then(() => "closed"),
      dialog
        .locator(".el-form-item.is-error")
        .first()
        .waitFor({ state: "visible", timeout: 15_000 })
        .then(() => "invalid")
    ]).catch(() => "closed");
    if (outcome !== "invalid") break;
    // 与报错同时关闭（成功路径）时不再补点
    if (!(await dialog.isVisible().catch(() => false))) break;
    // 等报错清除后再补点，避免点在仍处于校验失败状态的按钮上
    await dialog
      .locator(".el-form-item.is-error")
      .first()
      .waitFor({ state: "hidden", timeout: 10_000 })
      .catch(() => undefined);
  }
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
