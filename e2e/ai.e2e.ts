import { expect, test } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * AI 助手主链路（ADR-023）：E2E 环境无真实 LLM，覆盖配置保存与助手页
 * 「未配置/未启用」引导渲染；问答全链路由后端集成测试以 stub LLM 覆盖。
 */

test("AI 配置保存与助手页引导", async ({ page }) => {
  await login(page);

  // ---- 助手页：默认未启用 → 引导 ----
  await openMenuPath(page, ["集成管理"], "/integration/ai/index");
  await expect(page.getByText("AI 助手未启用")).toBeVisible({
    timeout: 15_000
  });

  // ---- 配置页：保存配置（保存后 retrieve 回显） ----
  await openMenuPath(page, ["集成管理"], "/integration/ai/config");
  const saveButton = page
    .getByRole("tabpanel", { name: "AI 配置" })
    .getByRole("button", { name: "保存" });
  await expect(saveButton).toBeVisible({ timeout: 15_000 });

  // 填写接口地址与模型（密钥 write_only：首次必填）
  const formItem = page.locator(".el-form-item", { hasText: "接口地址" });
  await formItem.locator("input").first().fill("https://ai.example.com/v1");
  const modelItem = page.locator(".el-form-item", { hasText: "模型" });
  await modelItem.locator("input").first().fill("deepseek-chat");
  const keyItem = page.locator(".el-form-item", { hasText: "API 密钥" });
  await keyItem.locator("input").first().fill("sk-e2e-secret");
  // 布尔字段渲染为 ReSegmented 分段控件（原生 input 隐藏），点可见分段标签
  await page
    .locator(".el-form-item", { hasText: "AI 助手" })
    .getByText("启用", { exact: true })
    .click();
  await saveButton.click();
  await expect(page.getByText("操作成功").first()).toBeVisible({
    timeout: 15_000
  });

  // ---- 助手页：已启用但 LLM 不可达 → 提问得到可读错误（非崩溃） ----
  await openMenuPath(page, ["集成管理"], "/integration/ai/index");
  await expect(page.getByTestId("ai-ask-input")).toBeVisible({
    timeout: 15_000
  });
  await page.getByTestId("ai-ask-input").fill("数据集如何做数据权限过滤？");
  await page.getByRole("button", { name: "提问" }).click();
  // E2E 环境无真实供应商：任何可读提示（失败文案）都算 UI 链路通过
  await expect(page.locator(".el-message").first()).toBeVisible({
    timeout: 30_000
  });
});

test("NL 查数：灰度开启后解释卡片渲染", async ({ page }) => {
  await login(page);

  // 配置页：开启 AI 助手 + NL 查数灰度（不配真实 LLM，解释动作将得到可读错误）
  await openMenuPath(page, ["集成管理"], "/integration/ai/config");
  const save = page
    .getByRole("tabpanel", { name: "AI 配置" })
    .getByRole("button", { name: "保存" });
  await expect(save).toBeVisible({ timeout: 15_000 });
  await page
    .locator(".el-form-item", { hasText: "接口地址" })
    .locator("input")
    .first()
    .fill("https://ai.example.com/v1");
  await page
    .locator(".el-form-item", { hasText: "API 密钥" })
    .locator("input")
    .first()
    .fill("sk-e2e");
  await page
    .locator(".el-form-item", { hasText: "模型" })
    .locator("input")
    .first()
    .fill("deepseek-chat");
  // 启用 AI 助手 + NL 查数（两个 ReSegmented 分段控件各点「启用」）
  const enableSwitches = page
    .getByRole("tabpanel", { name: "AI 配置" })
    .getByText("启用", { exact: true });
  await enableSwitches.nth(0).click();
  await enableSwitches.nth(1).click();
  await save.click();
  await expect(page.getByText("操作成功").first()).toBeVisible();

  // 助手页：数据查询页签出现 → 解释 → 无真实 LLM 得可读错误（UI 链路验证）
  await openMenuPath(page, ["集成管理"], "/integration/ai/index");
  await page.getByRole("tab", { name: "数据查询" }).click();
  await expect(page.getByTestId("ai-nl-input")).toBeVisible({
    timeout: 15_000
  });
  await page.getByTestId("ai-nl-input").fill("列出启用用户");
  await page.getByRole("button", { name: "解释查询" }).click();
  await expect(page.locator(".el-message").first()).toBeVisible({
    timeout: 30_000
  });
});
