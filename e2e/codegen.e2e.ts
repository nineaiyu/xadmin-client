import { expect, test, type Locator, type Page } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 代码生成器 GUI（generate_crud 引擎的 Web 化）。覆盖两条链路：
 *
 * 1) 选模型 → 字段勾选（序列化器字段面）→ 预览产物（不落盘）→ zip 下载；
 * 2) 生成方案（服务端存储）：保存 → 列表出现 → 载入回显 → 删除 → 列表消失。
 *
 * 定位统一走组件上的 data-testid 与 Element Plus 语义类，不依赖中文文案以外的
 * 不稳定结构；方案名带时间戳后缀并在用例内删除，保证双浏览器共享库下的幂等。
 */
const MODEL_SELECT = '[data-testid="codegen-model-select"]';
const PLAN_SELECT = '[data-testid="codegen-plan-select"]';
const PLAN_SAVE = '[data-testid="codegen-plan-save"]';
const PLAN_LOAD = '[data-testid="codegen-plan-load"]';
const PLAN_DELETE = '[data-testid="codegen-plan-delete"]';

/** 打开代码生成页并选定模型（demo.Book 在 e2e 种子内） */
async function openCodegenWithModel(page: Page) {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/codegen/index");
  const modelSelect = page.locator(MODEL_SELECT);
  await expect(modelSelect).toBeVisible({ timeout: 15_000 });
  await modelSelect.click();
  const option = page
    .locator(".el-select-dropdown__item")
    .filter({ hasText: "demo.Book" })
    .first();
  await expect(option).toBeVisible({ timeout: 15_000 });
  await option.click();
}

/**
 * 字段配置表的目标行：按「字段名」单元格的精确文本定位（该单元格只含行名，
 * 显示名在同行的另一个 div，避免用行级 hasText 命中 verbose_name 的误匹配）。
 */
function fieldRow(page: Page, name: string): Locator {
  return page
    .locator(".el-table__row")
    .filter({ has: page.locator(".text-xs.font-medium", { hasText: name }) })
    .first();
}

/** 字段行的「启用」开关（colEnabled 固定右列，即行内最后一个 el-switch） */
function includeSwitch(page: Page, name: string): Locator {
  return fieldRow(page, name).locator(".el-switch").last();
}

test("字段勾选 → 预览产物 → zip 下载", async ({ page }) => {
  await openCodegenWithModel(page);

  // 字段计划回显：pk 恒启用且不可排除
  const pk = includeSwitch(page, "pk");
  await expect(pk).toBeVisible({ timeout: 15_000 });
  await expect(pk.locator("input[type=checkbox]")).toBeChecked();
  await expect(pk.locator("input[type=checkbox]")).toBeDisabled();

  // 取消 isbn 的「启用」→ 序列化器字段面排除该字段
  const isbn = includeSwitch(page, "isbn");
  await expect(isbn.locator("input[type=checkbox]")).toBeChecked();
  await isbn.click();
  await expect(isbn.locator("input[type=checkbox]")).not.toBeChecked();

  // 预览：产物面板出现，序列化器内容排除已删字段
  await page.getByRole("button", { name: "预览产物" }).click();
  const codePanel = page.locator(".codegen-preview__code code");
  await expect(codePanel).toBeVisible({ timeout: 15_000 });
  await expect(codePanel).toContainText("class BookSerializer");
  await expect(codePanel).not.toContainText("isbn");

  // 下载：zip 触发浏览器下载事件
  const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
  await page.getByRole("button", { name: "下载 zip" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("generated-demo-Book.zip");
});

test("生成方案：保存 → 列表出现 → 载入回显 → 删除 → 列表消失", async ({
  page
}) => {
  await openCodegenWithModel(page);

  const suffix = `${Date.now()}`.slice(-7);
  const planName = `E2E方案${suffix}`;
  const isbn = includeSwitch(page, "isbn");
  await expect(isbn.locator("input[type=checkbox]")).toBeChecked();

  // 制造与默认态可辨识的差异：取消 isbn 启用后保存
  await isbn.click();
  await expect(isbn.locator("input[type=checkbox]")).not.toBeChecked();

  await page.locator(PLAN_SAVE).click();
  const saveBox = page.locator(".el-message-box").last();
  await expect(saveBox).toBeVisible({ timeout: 10_000 });
  await saveBox.locator("input").fill(planName);
  await saveBox.getByRole("button", { name: "确定" }).click();
  await expect(saveBox).toBeHidden({ timeout: 15_000 });

  // 方案出现在已存方案列表：选中即完成「列表出现」的断言
  const planSelect = page.locator(PLAN_SELECT);
  await planSelect.click();
  const planOption = page
    .locator(".el-select-dropdown__item")
    .filter({ hasText: planName })
    .first();
  await expect(planOption).toBeVisible({ timeout: 15_000 });
  await planOption.click();

  // 改动当前态（重新启用 isbn）后再载入，验证以方案为准回显（isbn 回到未启用）
  await isbn.click();
  await expect(isbn.locator("input[type=checkbox]")).toBeChecked();
  await page.locator(PLAN_LOAD).click();
  await expect(isbn.locator("input[type=checkbox]")).not.toBeChecked({
    timeout: 15_000
  });

  // 删除：确认后从列表消失
  await page.locator(PLAN_DELETE).click();
  const confirmBox = page.locator(".el-message-box").last();
  await expect(confirmBox).toBeVisible({ timeout: 10_000 });
  await confirmBox.getByRole("button", { name: "确定" }).click();
  await expect(confirmBox).toBeHidden({ timeout: 15_000 });

  await planSelect.click();
  await expect(
    page.locator(".el-select-dropdown__item").filter({ hasText: planName })
  ).toHaveCount(0, { timeout: 15_000 });
  await page.keyboard.press("Escape");
});
