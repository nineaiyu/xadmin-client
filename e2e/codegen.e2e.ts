import { expect, test } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 代码生成器 GUI（generate_crud 引擎的 Web 化）：
 * 选模型 → 字段勾选（序列化器字段面）→ 预览产物（不落盘）→ zip 下载。
 * 服务端复用同一引擎（CLI generate_crud），e2e 只守护 GUI 链路与产物形态。
 */
test("代码生成器：选模型 → 字段勾选 → 预览产物 → zip 下载", async ({
  page
}) => {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/codegen/index");

  // 模型清单加载（demo.Book 在 e2e 种子内）
  const modelSelect = page.locator(".el-select").first();
  await modelSelect.click();
  const option = page
    .locator(".el-select-dropdown__item")
    .filter({ hasText: "demo.Book" })
    .first();
  await expect(option).toBeVisible({ timeout: 15_000 });
  await option.click();

  // 字段计划回显：pk 恒选且禁用（主键不可排除）
  await expect(page.getByText("name（书籍名称）")).toBeVisible({
    timeout: 15_000
  });
  const pkCheckbox = page
    .locator(".el-checkbox")
    .filter({ hasText: "pk（" })
    .locator("input");
  await expect(pkCheckbox).toBeDisabled();
  await expect(pkCheckbox).toBeChecked();

  // 字段编辑：取消勾选 isbn → exclude 清单生效
  // （点击打在 .el-checkbox 包装层：原生 input 被 Element Plus 视觉隐藏，uncheck 不可达）
  const isbnCheckbox = page
    .locator(".el-checkbox")
    .filter({ hasText: "isbn（标准书号）" });
  await expect(isbnCheckbox.locator("input")).toBeChecked();
  await isbnCheckbox.click();
  await expect(isbnCheckbox.locator("input")).not.toBeChecked();

  // 预览：产物树出现，序列化器内容排除已删字段
  await page.getByRole("button", { name: "预览产物" }).click();
  const fileItems = page.locator(".el-scrollbar .px-3");
  await expect(fileItems.first()).toBeVisible({ timeout: 15_000 });
  await expect(fileItems).toHaveCount(9); // 后端 5 + 前端 3 + 菜单种子 1
  const codePanel = page.locator("pre code");
  await expect(codePanel).toBeVisible();
  await expect(codePanel).toContainText("class BookSerializer");
  await expect(codePanel).not.toContainText('"isbn"');

  // 下载：zip 触发浏览器下载事件
  const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
  await page.getByRole("button", { name: "下载 zip" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("generated-demo-Book.zip");
});
