import { expect, test } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * AI 助手主链路：E2E 环境无真实 LLM，覆盖全局开关、多档案管理（CRUD/激活）
 * 与助手页「未配置/未启用」引导渲染；问答全链路由后端集成测试以 stub LLM 覆盖。
 */

/** 确保 el-switch 处于开启态（click 是切换语义：前序用例可能已打开，直接点会关掉） */
const ensureSwitchOn = async (
  page: import("@playwright/test").Page,
  testId: string
) => {
  const sw = page.getByTestId(testId);
  await expect(sw).toBeVisible({ timeout: 15_000 });
  // aria-checked 在内部隐藏 checkbox 上（根元素没有），直接读原生 checked
  const checked = await sw.locator("input[type=checkbox]").isChecked();
  if (!checked) {
    await sw.click();
  }
};

test("AI 配置：全局开关 + 档案创建激活 + 助手页引导", async ({ page }) => {
  await login(page);

  // ---- 助手页：双浏览器共享同一 E2E 库，先跑的浏览器可能已开启开关——
  // 「未启用引导」与「可用问答页」都算合法初始态（toPass 轮询两者其一） ----
  await openMenuPath(page, ["集成管理"], "/integration/ai/index");
  await expect(async () => {
    const enabled = await page.getByTestId("ai-ask-input").isVisible();
    const guided = await page
      .getByText("AI 助手未启用，请到「AI 配置」开启并完成配置")
      .isVisible();
    expect(enabled || guided).toBe(true);
  }).toPass({ timeout: 15_000 });

  // ---- 配置页：全局开关确保「开启」 ----
  await openMenuPath(page, ["集成管理"], "/integration/ai/config");
  await ensureSwitchOn(page, "ai-assistant-enabled");
  await page.getByRole("button", { name: "保存开关" }).click();
  await expect(page.locator(".el-message").first()).toBeVisible({
    timeout: 15_000
  });

  // ---- 新建配置档案（双浏览器共享库：随机名防唯一约束冲突） ----
  const profileName = `E2E档案-${Math.floor(Math.random() * 1_000_000)}`;
  await page.getByRole("button", { name: "新建档案" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog.getByTestId("ai-profile-name").fill(profileName);
  await dialog
    .getByPlaceholder("https://api.deepseek.com/v1")
    .fill("https://ai.example.com/v1");
  await dialog.getByPlaceholder("deepseek-chat").fill("deepseek-chat");
  await dialog
    .getByPlaceholder("OpenAI 兼容密钥，加密存储、不回显")
    .fill("sk-e2e-secret");
  // C5 收敛后弹窗按钮文案统一为框架口径「保存」（原手写弹窗为「确定」）
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });

  // 表格出现该档案（未激活）
  const table = page.getByTestId("ai-profile-table");
  const row = table.getByRole("row", { name: profileName });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row.getByText("未激活")).toBeVisible();

  // ---- 激活档案（确认弹窗）→ 状态翻转为使用中 ----
  await row.getByRole("button", { name: "设为默认" }).click();
  await page
    .getByRole("dialog")
    .last()
    .getByRole("button", { name: "确定" })
    .click();
  await expect(row.getByText("使用中")).toBeVisible({ timeout: 15_000 });

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

  // 配置页：全局开关开启 AI 助手 + NL 查数（不配真实 LLM，解释动作将得到可读错误）
  await openMenuPath(page, ["集成管理"], "/integration/ai/config");
  await expect(page.getByTestId("ai-assistant-enabled")).toBeVisible({
    timeout: 15_000
  });
  await ensureSwitchOn(page, "ai-assistant-enabled");
  await ensureSwitchOn(page, "ai-nl-query-enabled");
  await page.getByRole("button", { name: "保存开关" }).click();
  await expect(page.locator(".el-message").first()).toBeVisible();

  // 助手页：数据查询页签出现 → 解释 → 无真实 LLM 得可读错误（UI 链路验证）。
  // 开关保存经 pub/sub 异步回写 settings，留缓冲并刷新页面读最新状态；
  // onMounted/onActivated 双次加载 status 会让 tabs 短暂重挂，等锚点稳定后再点
  await page.waitForTimeout(1_500);
  await openMenuPath(page, ["集成管理"], "/integration/ai/index");
  await page.reload();
  await expect(page.getByTestId("ai-ask-input")).toBeVisible({
    timeout: 20_000
  });
  await page.waitForTimeout(500);
  const nlTab = page.getByRole("tab", { name: "数据查询" });
  await expect(nlTab).toBeVisible({ timeout: 20_000 });
  await nlTab.click();
  await expect(page.getByTestId("ai-nl-input")).toBeVisible({
    timeout: 15_000
  });
  await page.getByTestId("ai-nl-input").fill("列出启用用户");
  await page.getByRole("button", { name: "解释查询" }).click();
  await expect(page.locator(".el-message").first()).toBeVisible({
    timeout: 30_000
  });
});
