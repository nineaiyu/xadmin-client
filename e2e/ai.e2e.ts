import { expect, test, type Page } from "@playwright/test";

import { FRONT_URL, login, openMenuPath } from "./helpers";

/**
 * AI 助手主链路：覆盖全局开关、多档案管理（CRUD/激活）、助手页引导渲染，
 * 以及指向桩 LLM 的真实流式问答（思考过程面板 + 增量回答上屏）。
 * 桩 LLM：playwright webServer 拉起的 scripts/stub_llm.py（支持 SSE 流式）。
 */

const STUB_LLM_URL =
  process.env.E2E_STUB_LLM_URL ?? "http://127.0.0.1:18897/v1";

async function jsonRequest(
  page: Page,
  method: "post" | "patch",
  path: string,
  data?: unknown
) {
  const response = await page.request[method](`${FRONT_URL}${path}`, {
    data: data ?? {}
  });
  return (await response.json()) as {
    code: number;
    data: Record<string, unknown> | null;
    detail?: string;
  };
}

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
  const row = page.getByRole("row", { name: profileName });
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
  await page.getByTestId("ai-send").click();
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

  // 助手页：数据查询入口出现 → 解释 → 无真实 LLM 得可读错误（UI 链路验证）。
  // 开关保存经 pub/sub 异步回写 settings，留缓冲并刷新页面读最新状态；
  // 左栏入口由权限点组装，等锚点稳定后再点
  await page.waitForTimeout(1_500);
  await openMenuPath(page, ["集成管理"], "/integration/ai/index");
  await page.reload();
  await expect(page.getByTestId("ai-ask-input")).toBeVisible({
    timeout: 20_000
  });
  await page.waitForTimeout(500);
  const nlEntry = page.getByTestId("ai-feature-nl");
  await expect(nlEntry).toBeVisible({ timeout: 20_000 });
  await nlEntry.click();
  await expect(page.getByTestId("ai-ask-input")).toBeVisible({
    timeout: 15_000
  });
  await page.getByTestId("ai-ask-input").fill("列出启用用户");
  await page.getByTestId("ai-send").click();
  await expect(page.locator(".el-message").first()).toBeVisible({
    timeout: 30_000
  });
});

test("文档问答：流式回答 + 思考过程展示（指向桩 LLM）", async ({ page }) => {
  await login(page);

  // 前置（API 化，避免 UI 长链路）：全局开关 + 知识文档（保证检索命中）+
  // 指向桩 LLM 的档案并激活——这也是「多档案激活优先」通路的实测。
  const saved = await jsonRequest(
    page,
    "patch",
    "/api/system/ai/assistant/config",
    { AI_ASSISTANT_ENABLED: true }
  );
  expect(saved.code).toBe(1000);

  const doc = await jsonRequest(
    page,
    "post",
    "/api/system/ai/knowledge-documents",
    {
      name: `E2E知识-${Date.now()}`,
      content:
        "# E2E 知识文档\n\n## 数据权限\n\n数据集执行时按调用者的数据权限过滤。\n"
    }
  );
  expect(doc.code).toBe(1000);

  const created = await jsonRequest(page, "post", "/api/system/ai/profiles", {
    name: `E2E-问答档案-${Date.now()}`,
    base_url: STUB_LLM_URL,
    api_key: "sk-e2e-stub",
    model: "stub-model"
  });
  expect(created.code).toBe(1000);
  const activated = await jsonRequest(
    page,
    "post",
    `/api/system/ai/profiles/${String(created.data?.pk ?? "")}/activate`
  );
  expect(activated.code).toBe(1000);

  // 助手页提问：思考面板先出现（桩产出 reasoning 帧），回答流式上屏
  await openMenuPath(page, ["集成管理"], "/integration/ai/index");
  await expect(page.getByTestId("ai-ask-input")).toBeVisible({
    timeout: 15_000
  });
  const uniqueQuestion = `数据集如何做数据权限过滤？(E2E-${Date.now()})`;
  await page.getByTestId("ai-ask-input").fill(uniqueQuestion);
  await page.getByTestId("ai-send").click();

  await expect(page.getByTestId("ai-thinking").first()).toBeVisible({
    timeout: 20_000
  });
  await expect(
    page.getByText("这是 E2E 桩 LLM 的固定回答。").first()
  ).toBeVisible({ timeout: 20_000 });

  // ---- 对话持久化：刷新后本轮提问与回答仍在（服务端消息流） ----
  await page.reload();
  await expect(page.getByTestId("ai-ask-input")).toBeVisible({
    timeout: 20_000
  });
  await expect(
    page.getByTestId("ai-messages").getByText(uniqueQuestion)
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page
      .getByTestId("ai-messages")
      .getByText("这是 E2E 桩 LLM 的固定回答。")
      .first()
  ).toBeVisible();
});

test("指令执行：草稿确认卡片 + 确认执行（指向桩 LLM）", async ({ page }) => {
  await login(page);

  // 前置（API 化）：助手开关 + 动作灰度 + 指向桩 LLM 的激活档案
  const saved = await jsonRequest(
    page,
    "patch",
    "/api/system/ai/assistant/config",
    { AI_ASSISTANT_ENABLED: true, AI_ACTION_ENABLED: true }
  );
  expect(saved.code).toBe(1000);

  const created = await jsonRequest(page, "post", "/api/system/ai/profiles", {
    name: `E2E-动作档案-${Date.now()}`,
    base_url: STUB_LLM_URL,
    api_key: "sk-e2e-stub",
    model: "stub-model"
  });
  expect(created.code).toBe(1000);
  const activated = await jsonRequest(
    page,
    "post",
    `/api/system/ai/profiles/${String(created.data?.pk ?? "")}/activate`
  );
  expect(activated.code).toBe(1000);

  // 灰度生效确认（Setting 保存后经 pub/sub 异步回写 settings）
  await expect(async () => {
    const probe = await page.request.get(
      `${FRONT_URL}/api/system/ai/assistant/status`
    );
    const body = (await probe.json()) as {
      data: { action_enabled?: boolean; actions?: unknown[] };
    };
    expect(body.data?.action_enabled).toBe(true);
    expect((body.data?.actions ?? []).length).toBeGreaterThan(0);
  }).toPass({ timeout: 20_000 });

  await openMenuPath(page, ["集成管理"], "/integration/ai/index");
  await expect(page.getByTestId("ai-ask-input")).toBeVisible({
    timeout: 15_000
  });
  // 切到「指令执行」入口（按权限点组装）
  const actionEntry = page.getByTestId("ai-feature-action");
  await expect(actionEntry).toBeVisible({ timeout: 20_000 });
  await actionEntry.click();

  // 桩 LLM：请求携带动作目录标记 → 返回 leave.submit 草稿（日期取消息内唯一日期）。
  // 日期取「远期随机日」：既有请假单按区间查重，固定日期在重试时会撞区间重叠
  const uniqueDate = new Date(
    Date.now() + (300 + Math.floor(Math.random() * 3000)) * 24 * 3600 * 1000
  )
    .toISOString()
    .slice(0, 10);
  await page
    .getByTestId("ai-ask-input")
    .fill(`帮我提交 ${uniqueDate} 的年假申请（E2E 动作链路）`);
  await page.getByTestId("ai-send").click();

  // 草稿卡片出现（AI 只产出草稿，执行需用户确认）
  const card = page.getByTestId("ai-action-card").last();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.getByTestId("ai-action-confirm").click();

  // 执行成功：结果回执作为消息落库并上屏（E2E 环境无审批流程 → 落为草稿）
  await expect(
    page
      .getByTestId("ai-messages")
      .getByText(/草稿|已提交审批|已执行/)
      .first()
  ).toBeVisible({ timeout: 30_000 });
});
