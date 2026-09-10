import { expect, test, type Locator, type Page } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 导入列映射与模板（用户管理）：
 * ① 表头与字段名不一致时，列映射面板给出「未匹配」提示，手工映射后导入成功；
 * ② 映射可另存为模板并复用于同构文件的第二次导入；
 * ③ 不做映射时（仅校验）不静默成功：既提示未匹配列，也报出失败行。
 *
 * 后端实现：`import-headers` 读首行表头，`import-data / import-validate / import-async`
 * 共用同一份映射解析（template_id 优先，其次 mapping 明文）。
 */

const PASSWORD = "E2E-Import-2026!";
const CSV_HEADERS = "用户名列,昵称列,密码列";

/** 已在用户管理页时直接打开导入弹窗（同一用例内第二次导入复用） */
async function openDialogOnUserPage(page: Page) {
  await openMenuPath(page, ["系统管理"], "/system/user/index");
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });
  // 工具栏第 3 个按钮 = 导入（前两个为新增 / 导出）
  await page
    .locator("div.flex.mr-4")
    .first()
    .locator("button.el-button")
    .nth(2)
    .click();
  const dialog = page.locator(".el-dialog", { hasText: "导入" }).first();
  await expect(dialog).toBeVisible();
  return dialog;
}

async function openImportDialog(page: Page) {
  await login(page);
  return openDialogOnUserPage(page);
}

async function uploadCsv(
  dialog: Locator,
  csv: string,
  name = "e2e-mapping.csv"
) {
  await dialog
    .locator("input[type='file']")
    .first()
    .setInputFiles({
      name,
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf-8")
    });
}

/** 等待列映射面板出现（表头解析完成）并返回映射表格 */
async function waitMappingPanel(dialog: Locator) {
  const table = dialog.locator(".el-table").last();
  await expect(table).toContainText("目标字段", { timeout: 20_000 });
  return table;
}

/**
 * 选中 el-select 的选项：filterable 输入过滤后定点点击。
 *
 * 不用全局 `.el-select-dropdown:visible`：弹窗内同时存在多个 popper，
 * 命中隐藏 popper 的选项会稳定失败（实测）。改用输入框 aria-controls 定位唯一 popper。
 */
async function pickOption(page: Page, trigger: Locator, label: string) {
  const input = trigger.locator("input.el-select__input").first();
  await input.click();
  const controls = await input.getAttribute("aria-controls");
  await input.fill(label);
  if (controls) {
    const option = page
      .locator(`#${controls} .el-select-dropdown__item`)
      .filter({ hasText: label })
      .first();
    await expect(option).toBeVisible({ timeout: 10_000 });
    await option.click();
  } else {
    await page.keyboard.press("Enter");
  }
}

async function pickField(
  page: Page,
  dialog: Locator,
  header: string,
  fieldLabel: string
) {
  const row = dialog.locator(".el-table__row", { hasText: header }).first();
  await pickOption(page, row.locator(".el-select").first(), fieldLabel);
}

async function submitDialog(dialog: Locator) {
  await dialog
    .getByRole("button", { name: /保存|确定/ })
    .first()
    .click();
}

async function searchUser(page: Page, username: string) {
  const expandBtn = page.getByRole("button", { name: /展开/ });
  if (await expandBtn.isVisible().catch(() => false)) {
    await expandBtn.click();
  }
  await page.getByPlaceholder("请输入用户名").first().fill(username);
  await page.getByRole("button", { name: "搜索" }).first().click();
  await expect(
    page.locator(".el-table__row", { hasText: username }).first()
  ).toBeVisible({ timeout: 20_000 });
}

test("列名不匹配 → 列映射导入成功", async ({ page }) => {
  const username = `e2e_map_${Date.now()}`;
  const dialog = await openImportDialog(page);
  await uploadCsv(
    dialog,
    `${CSV_HEADERS}\n${username},E2E映射用户,${PASSWORD}\n`
  );

  // 表头与字段名不同名：面板提示「未匹配到字段」，不做模糊推断
  const table = await waitMappingPanel(dialog);
  await expect(table).toContainText("未匹配到字段");

  await pickField(page, dialog, "用户名列", "用户名");
  await pickField(page, dialog, "昵称列", "昵称");
  await pickField(page, dialog, "密码列", "密码");

  await submitDialog(dialog);
  await expect(dialog).not.toBeVisible({ timeout: 30_000 });
  await searchUser(page, username);
});

test("映射另存为模板并可复用于第二次导入", async ({ page }) => {
  const templateName = `e2e模板_${Date.now()}`;
  const firstUser = `e2e_tpl_${Date.now()}`;
  const dialog = await openImportDialog(page);
  await uploadCsv(
    dialog,
    `${CSV_HEADERS}\n${firstUser},模板用户一,${PASSWORD}\n`
  );
  await waitMappingPanel(dialog);

  await pickField(page, dialog, "用户名列", "用户名");
  await pickField(page, dialog, "昵称列", "昵称");
  await pickField(page, dialog, "密码列", "密码");

  await dialog.getByPlaceholder("模板名称").fill(templateName);
  await dialog.getByRole("button", { name: "另存为模板" }).click();
  await expect(page.getByText("映射模板已保存")).toBeVisible({
    timeout: 20_000
  });

  await submitDialog(dialog);
  await expect(dialog).not.toBeVisible({ timeout: 30_000 });
  await searchUser(page, firstUser);

  // 第二次导入：同构表头的另一份文件，直接套用刚保存的模板
  const secondUser = `e2e_tpl2_${Date.now()}`;
  const reopened = await openDialogOnUserPage(page);
  await uploadCsv(
    reopened,
    `${CSV_HEADERS}\n${secondUser},模板用户二,${PASSWORD}\n`,
    "e2e-mapping-second.csv"
  );
  await waitMappingPanel(reopened);
  // 模板下拉是弹窗内第一个 el-select（表单区只有 radio/switch）
  await pickOption(page, reopened.locator(".el-select").first(), templateName);

  await submitDialog(reopened);
  await expect(reopened).not.toBeVisible({ timeout: 30_000 });
  await searchUser(page, secondUser);
});

test("不做映射不静默成功：提示未匹配列且校验报失败行", async ({ page }) => {
  const username = `e2e_nomap_${Date.now()}`;
  const dialog = await openImportDialog(page);
  await dialog.getByText("仅校验").first().click();
  await uploadCsv(
    dialog,
    `${CSV_HEADERS}\n${username},未映射用户,${PASSWORD}\n`
  );

  const table = await waitMappingPanel(dialog);
  await expect(table).toContainText("未匹配到字段");

  await submitDialog(dialog);
  const resultDialog = page
    .locator(".el-dialog", { hasText: "导入校验结果" })
    .first();
  await expect(resultDialog).toBeVisible({ timeout: 30_000 });
  await expect(resultDialog).toContainText("失败 1 行");
});
