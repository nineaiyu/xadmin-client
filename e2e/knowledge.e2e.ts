import { expect, test } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 批量操作（框架能力 + 自定义批量启停）：上传两条 → 勾选 → 批量停用（分块移除）
 * → 批量启用（分块重建）→ 批量删除（仅上传文档，分块随删除清理）。
 *
 * 批量删除为 RePlusPage 内建入口（勾选行后工具栏出现，popconfirm 带计数确认），
 * 批量启用/停用为页面自定义工具栏按钮（后端 batch-toggle）。
 */
test("知识库：批量启用停用 + 批量删除", async ({ page }) => {
  const stamp = Date.now();
  const titles = [`E2E批量甲-${stamp}`, `E2E批量乙-${stamp}`];
  await login(page);
  await openMenuPath(page, ["集成管理"], "/integration/knowledge/index");
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });

  // 两条上传文档（同名不同标题，各两个章节）
  for (const title of titles) {
    await page.getByRole("button", { name: "上传文档" }).first().click();
    const dialog = page.locator(".el-dialog:visible").first();
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await dialog.getByTestId("knowledge-name-input").fill(title);
    await dialog
      .getByTestId("knowledge-content-input")
      .fill(
        `# ${title}\n\n## 章节一\n\n批量内容甲。\n\n## 章节二\n\n批量内容乙。`
      );
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });
  }

  const rowsOf = (title: string) =>
    page.locator(".el-table__row", { hasText: title }).first();
  await expect(rowsOf(titles[0])).toBeVisible({ timeout: 15_000 });
  await expect(rowsOf(titles[1])).toBeVisible({ timeout: 15_000 });

  // 勾选两条：行首复选框
  for (const title of titles) {
    await rowsOf(title).locator(".el-checkbox").first().click();
  }

  // 批量停用 → 行内按钮翻转为「启用」
  await page.getByRole("button", { name: "批量停用" }).first().click();
  for (const title of titles) {
    await expect(
      rowsOf(title).getByRole("button", { name: "启用" })
    ).toBeVisible({
      timeout: 15_000
    });
  }

  // 批量启用 → 行内按钮翻转为「停用」
  await page.getByRole("button", { name: "批量启用" }).first().click();
  for (const title of titles) {
    await expect(
      rowsOf(title).getByRole("button", { name: "停用" })
    ).toBeVisible({
      timeout: 15_000
    });
  }

  // 批量删除（勾选态保持）→ 两行消失
  await page.getByRole("button", { name: "批量删除" }).first().click();
  await page
    .locator(".el-popconfirm, .el-popper, .el-message-box")
    .getByRole("button", { name: "确定" })
    .first()
    .click();
  for (const title of titles) {
    await expect(
      page.locator(".el-table__row", { hasText: title })
    ).toHaveCount(0, { timeout: 15_000 });
  }
});
/**
 * AI 知识库文档管理 E2E：
 * 上传（弹窗内粘贴 Markdown 文本）→ 列表可见（分块数）→ 预览抽屉（全文 + 分块清单）
 * → 停用/启用（按钮文案随状态翻转）→ 删除（popconfirm）→ 行消失。
 *
 * 上传即入检索索引（分块表），问答链路（ask/nl-query）复用同一份数据，
 * 后端集成测试已锁定检索命中；本用例覆盖管理面单条操作全链路。
 */
test("知识库：上传 → 预览 → 停用启用 → 删除", async ({ page }) => {
  const stamp = Date.now();
  const title = `E2E知识-${stamp}`;
  await login(page);

  await openMenuPath(page, ["集成管理"], "/integration/knowledge/index");
  const table = page.locator(".el-table").first();
  await expect(table).toBeVisible({ timeout: 15_000 });

  // ---- 上传（粘贴文本，含两个 ## 章节 → 3 个分块）----
  await page.getByRole("button", { name: "上传文档" }).first().click();
  const dialog = page.locator(".el-dialog:visible").first();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  // ElInput 的 attrs 透传到内部 input/textarea（inheritAttrs:false），testid 直接落在控件上
  await dialog.getByTestId("knowledge-name-input").fill(title);
  await dialog
    .getByTestId("knowledge-content-input")
    .fill(
      `# ${title}\n\n## 章节一\n\nE2E 知识内容甲（登录说明）。\n\n## 章节二\n\nE2E 知识内容乙（报表说明）。`
    );
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 15_000 });

  // ---- 列表可见：分块数 3 ----
  const row = page.locator(".el-table__row", { hasText: title }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row).toContainText("3");

  // ---- 预览抽屉：全文 + 分块清单 ----
  await row.getByRole("button", { name: "预览" }).first().click();
  const drawer = page.locator(".el-drawer:visible").first();
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  await expect(drawer.getByTestId("knowledge-preview-content")).toContainText(
    "E2E 知识内容甲"
  );
  await expect(drawer).toContainText("知识分块");
  await drawer.locator(".el-drawer__close-btn").click();
  await expect(drawer).not.toBeVisible({ timeout: 10_000 });

  // ---- 停用/启用：按钮文案随状态翻转 ----
  await row.getByRole("button", { name: "停用" }).click();
  await expect(row.getByRole("button", { name: "启用" })).toBeVisible({
    timeout: 15_000
  });
  await row.getByRole("button", { name: "启用" }).click();
  await expect(row.getByRole("button", { name: "停用" })).toBeVisible({
    timeout: 15_000
  });

  // ---- 删除（popconfirm）→ 行消失 ----
  await row.getByRole("button", { name: "删除" }).first().click();
  await page
    .locator(".el-popconfirm, .el-popper, .el-message-box")
    .getByRole("button", { name: "确定" })
    .first()
    .click();
  await expect(page.locator(".el-table__row", { hasText: title })).toHaveCount(
    0,
    { timeout: 15_000 }
  );
});
