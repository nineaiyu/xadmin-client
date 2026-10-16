import { expect, test, type Locator, type Page } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 通知公告 CRUD E2E：新增（富文本 + 字典级别）→ 列表可见（级别字典色渲染）→
 * 编辑标题 → 删除。补齐此前「页面可打开」之外的写链路，同时验收 notice_level
 * 字典化改造的前端渲染（level 列 el-text style 字典色优先）。
 *
 * 定位纪律：页面预置了隐藏的查看弹层，一律用 `.el-dialog:visible` 锁定当前弹窗，
 * 不用 `.first()` 裸匹配（会命中隐藏节点）。
 */

/** 弹窗内选下拉项：按可见选项文案匹配（级别/类型/用户均走 el-select） */
async function pickSelectOption(page: Page, dialog: Locator, label: string) {
  const option = page
    .locator(".el-select-dropdown__item")
    .filter({ hasText: label })
    .locator("visible=true")
    .first();
  await expect(option).toBeVisible({ timeout: 10_000 });
  await option.click();
}

test("通知公告：新增（富文本 + 字典级别）→ 列表可见含字典色 → 查看 → 编辑 → 删除", async ({
  page
}) => {
  const title = `E2E公告-${Date.now()}`;
  // 编辑器高度告警守护：WangEditor/NoticeShow 的编辑区高度依赖容器确定高度，一旦退化为
  // 内容高度（空内容约 52px）就会告警「编辑区域高度 < 300px 这可能会导致 modal hoverbar
  // 定位异常」并使 hoverbar/modal 定位偏移（修法见两个组件的 scoped 样式）。
  const editorWarnings: string[] = [];
  page.on("console", msg => {
    if (msg.type() === "warning" && msg.text().includes("300px")) {
      editorWarnings.push(msg.text());
    }
  });
  await login(page);
  await openMenuPath(page, ["系统管理", "通知公告"], "/system/notice/index");

  const table = page.locator(".el-table").first();
  await expect(table).toBeVisible({ timeout: 15_000 });

  // 新增
  await page.getByRole("button", { name: "新增" }).first().click();
  const dialog = page.locator(".el-dialog:visible");
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByPlaceholder("请输入标题").first().fill(title);
  // 通知级别（notice_level 字典下发：普遍通知 info/#909399）
  await dialog.locator(".el-select").first().click();
  await pickSelectOption(page, dialog, "普遍通知");
  // 通知类型保持默认「用户通知」时必须选择用户：api-search-user 表格弹层
  const userSelect = dialog.locator(".el-select").last();
  await userSelect.click();
  const pickerTable = page.locator(".el-table").last();
  await pickerTable
    .locator(".el-table__row")
    .first()
    .waitFor({ state: "visible", timeout: 15_000 });
  await page
    .locator(".el-loading-mask:visible")
    .first()
    .waitFor({ state: "hidden", timeout: 15_000 })
    .catch(() => undefined);
  await pickerTable
    .locator(".el-table__row")
    .first()
    .locator(".el-checkbox")
    .first()
    .click();
  await page.getByRole("button", { name: "确定" }).last().click();
  // 正文（WangEditor）：真实键盘输入
  // 附件菜单（uploadAttachment）由 @wangeditor/plugin-upload-attachment 提供、在
  // src/App.vue 注册（需在创建编辑器前且只能注册一次）。历史上 rolldown 预打包会把
  // 该 UMD 插件的默认导出裹成 `{ default: module }`，注册静默失效、工具栏抛
  // "Not found menu item factory by key 'uploadAttachment'"——此处守护菜单真实渲染。
  await expect(
    dialog.locator('[data-menu-key="uploadAttachment"]').first()
  ).toBeVisible({ timeout: 15_000 });
  const editor = dialog.locator("[contenteditable='true']").first();
  await editor.click();
  await page.keyboard.type("E2E 通知公告内容");
  await dialog
    .getByRole("button", { name: /保存|确定/ })
    .first()
    .click();
  await expect(page.locator(".el-dialog:visible")).toHaveCount(0, {
    timeout: 15_000
  });

  // 列表可见；级别列 el-text 带字典色（style 内联 color）
  const row = page.locator(".el-table__row", { hasText: title }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  const levelText = row.locator(".el-text").first();
  await expect(levelText).toBeVisible();
  await expect(levelText).toHaveAttribute("style", /color:\s*rgb/);

  // 查看弹层（NoticeShow 只读编辑器）：与新增弹窗同源的高度修复须生效（≥300px 告警阈值）。
  // 行内按钮顺序为 编辑/删除/详情，「详情」无文字（icon=View、仅 tooltip），故按序号取
  await row.hover();
  await row.locator("button").nth(2).click();
  const detailDialog = page.locator(".el-dialog:visible");
  await expect(detailDialog).toBeVisible({ timeout: 10_000 });
  await expect(detailDialog.locator(".w-e-scroll").first()).toBeVisible({
    timeout: 10_000
  });
  const detailEditorH = await detailDialog
    .locator(".w-e-scroll")
    .first()
    .evaluate(el => (el as HTMLElement).offsetHeight);
  expect(detailEditorH).toBeGreaterThanOrEqual(300);
  await detailDialog.locator(".el-dialog__headerbtn").first().click();
  await expect(page.locator(".el-dialog:visible")).toHaveCount(0, {
    timeout: 10_000
  });

  // 编辑：改标题后新标题可见
  const edited = `${title}-改`;
  await row.hover();
  await row.getByRole("button", { name: /编辑/ }).first().click();
  const editDialog = page.locator(".el-dialog:visible");
  await expect(editDialog).toBeVisible({ timeout: 10_000 });
  await editDialog.getByPlaceholder("请输入标题").first().fill(edited);
  await editDialog
    .getByRole("button", { name: /保存|确定/ })
    .first()
    .click();
  await expect(page.locator(".el-dialog:visible")).toHaveCount(0, {
    timeout: 15_000
  });
  await expect(
    page.locator(".el-table__row", { hasText: edited }).first()
  ).toBeVisible({ timeout: 15_000 });

  // 删除（行内 Popconfirm 确认），行消失
  const editedRow = page.locator(".el-table__row", { hasText: edited }).first();
  await editedRow.hover();
  await editedRow.getByRole("button", { name: "删除" }).first().click();
  const confirm = page
    .locator(".el-popconfirm, .el-popper")
    .getByRole("button", { name: "确定" })
    .first();
  await expect(confirm).toBeVisible({ timeout: 10_000 });
  await confirm.click();
  await expect(page.locator(".el-table__row", { hasText: edited })).toHaveCount(
    0
  );

  // 全流程（创建/编辑/查看三处编辑器）都不应出现编辑区高度告警
  expect(editorWarnings).toEqual([]);
});
