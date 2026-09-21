import { expect, test, type Page } from "@playwright/test";

import {
  APPROVER,
  FRONT_URL,
  login,
  openMenuPath,
  waitAppWebSocket
} from "./helpers";

/**
 * AI 受限动作 E2E（A2 全链路）：AI 配置（桩 LLM）→ 聊天室 /do 生成动作草稿 →
 * 确认卡片 → 以用户身份执行 → 结果回执。
 *
 * 桩 LLM：playwright webServer 拉起的 scripts/stub_llm.py（确定性草稿），
 * 用例把 AI 配置档案指向它——这也是「多档案激活优先」通路的实测。
 * 动态表单名字带随机后缀：双浏览器共享库，避免同名 unique 冲突（见 e2e/README）。
 * 会话按用户隔离（双超管各一间 AI 房）：双浏览器先后运行共享库，后跑的浏览器
 * 会看到先跑浏览器的历史卡片，卡片定位一律取 .last()（最新一条）。
 */

const STUB_LLM_URL =
  process.env.E2E_STUB_LLM_URL ?? "http://127.0.0.1:18897/v1";
const CHAT_PATH = "/default/chat/index";

async function jsonRequest(
  page: Page,
  method: "post" | "get" | "patch" | "delete",
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

async function enableAiAction(page: Page) {
  // 全局开关 + 动作灰度（Setting 通路），再建档案指向桩 LLM 并激活
  const saved = await jsonRequest(
    page,
    "patch",
    "/api/system/ai/assistant/config",
    {
      AI_ASSISTANT_ENABLED: true,
      AI_ACTION_ENABLED: true
    }
  );
  expect(saved.code).toBe(1000);

  const profileName = `E2E-AI动作档案-${Date.now()}`;
  const created = await jsonRequest(page, "post", "/api/system/ai/profiles", {
    name: profileName,
    base_url: STUB_LLM_URL,
    api_key: "sk-e2e-stub",
    model: "stub-model"
  });
  expect(created.code).toBe(1000);
  const pk = String(created.data?.pk ?? "");
  expect(pk).toBeTruthy();
  const activated = await jsonRequest(
    page,
    "post",
    `/api/system/ai/profiles/${pk}/activate`
  );
  expect(activated.code).toBe(1000);
  return { profileName, profilePk: pk };
}

async function createE2eForm(page: Page) {
  const name = `E2E-AI动作表单-${Date.now()}`;
  const created = await jsonRequest(page, "post", "/api/system/dynamic-forms", {
    name,
    description: "AI 动作草稿 E2E 专用表单",
    is_active: true,
    approval_required: false,
    schema: {
      fields: [
        {
          key: "note",
          label: "备注",
          type: "input",
          required: false,
          max_length: 100
        }
      ]
    }
  });
  expect(created.code).toBe(1000);
  return { name, pk: String(created.data?.pk ?? "") };
}

async function openAiRoom(page: Page) {
  await openMenuPath(page, [], CHAT_PATH);
  await expect(page.locator('[data-testid="chat-page"]')).toBeVisible({
    timeout: 20_000
  });
  await page.locator('[data-testid="chat-room-ai"]').first().click();
  const input = page.locator('[data-testid="chat-input"] textarea');
  await input.waitFor({ state: "visible", timeout: 20_000 });
  return input;
}

test("AI 受限动作：/do 草稿 → 确认卡片 → 执行动态表单提交", async ({
  page
}) => {
  test.setTimeout(150_000);
  const wsOpened = waitAppWebSocket(page);
  await login(page);
  await wsOpened;

  const form = await createE2eForm(page);
  await enableAiAction(page);
  const input = await openAiRoom(page);

  await input.fill(`/do 请用表单「${form.name}」提交一条记录，备注写 E2E`);
  await page.getByRole("button", { name: "发送" }).first().click();

  // AI 草稿消息带确认卡片（流式 done 帧回填正式载荷）。
  // 卡片必须按「本 run 唯一的表单名」定位：共享库里同房间有历史卡片，按 .last()
  // 取「最新」会在新卡片尚未渲染时命中历史卡片（历史卡片同样可见可点，且其表单
  // 已被清理，执行必然失败）。
  const messages = page.locator('[data-testid="chat-messages"]');
  const card = messages
    .locator('[data-testid="chat-action-card"]', { hasText: form.name })
    .first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card.getByText("提交动态表单")).toBeVisible();

  // 确认执行 → 卡片进入已执行态，房间收到结果回执（回执条数在执行前基线上 +1）
  const receipts = messages.getByText("AI 动作已执行：表单已提交");
  const receiptsBefore = await receipts.count();
  await card.getByTestId("chat-action-confirm").click();
  await expect(card.getByText("表单已提交")).toBeVisible({ timeout: 30_000 });
  await expect(receipts).toHaveCount(receiptsBefore + 1, { timeout: 15_000 });

  // 业务侧落库：我的提交里出现该表单记录（提交接口无 filterset，按 form_name 匹配）
  const listed = await jsonRequest(
    page,
    "get",
    "/api/system/dynamic-form-submissions"
  );
  expect(listed.code).toBe(1000);
  const rows = (listed.data?.results ?? []) as Array<Record<string, unknown>>;
  const mine = rows.find(row => row.form_name === form.name);
  expect(mine).toBeTruthy();

  // 清理：删除提交与表单（本人可删）
  await jsonRequest(
    page,
    "delete",
    `/api/system/dynamic-form-submissions/${mine?.pk}`
  );
  await jsonRequest(page, "delete", `/api/system/dynamic-forms/${form.pk}`);
});

test("AI 受限动作：灰度关闭时 /do 给出可读降级", async ({ page }) => {
  test.setTimeout(120_000);
  const wsOpened = waitAppWebSocket(page);
  // 独立用户：其 AI 房间无历史卡片，避免共享库里先跑用例的卡片干扰计数断言
  await login(page, APPROVER);
  await wsOpened;

  // 先完整启用（助手开关 + 档案 + 动作灰度），再单独关闭动作灰度，隔离被测变量
  await enableAiAction(page);
  const disabled = await jsonRequest(
    page,
    "patch",
    "/api/system/ai/assistant/config",
    {
      AI_ASSISTANT_ENABLED: true,
      AI_ACTION_ENABLED: false
    }
  );
  expect(disabled.code).toBe(1000);

  const input = await openAiRoom(page);
  await input.fill("/do 帮我请一天年假");
  await page.getByRole("button", { name: "发送" }).first().click();

  // 后端把门禁错误落成 system 消息（前端可见），不产生动作草稿
  await expect(
    page
      .locator('[data-testid="chat-messages"]')
      .getByText("AI 动作未开启")
      .first()
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-testid="chat-action-card"]')).toHaveCount(0);

  // 恢复开启：避免影响同库后续用例（如重跑上一条用例）
  await jsonRequest(page, "patch", "/api/system/ai/assistant/config", {
    AI_ASSISTANT_ENABLED: true,
    AI_ACTION_ENABLED: true
  });
});

// 引用 AI 配置页路径的冒烟断言：确认灰度开关出现在全局开关卡片上
test("AI 配置页展示 AI 动作灰度开关", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  await openMenuPath(page, ["集成管理"], "/integration/ai/config");
  await expect(page.getByTestId("ai-action-enabled")).toBeVisible({
    timeout: 20_000
  });
});

test("AI 受限动作：/do 发全体公告 → 确认卡片 → 执行发布", async ({ page }) => {
  await login(page);
  await enableAiAction(page);

  const input = await openAiRoom(page);
  await input.fill("/do 发个全体公告，内容是大家好");
  await input.press("Enter");

  // 确认卡片：断言参数值（与界面语言无关；label 文案随服务端 gettext 语言变化）
  const card = page.locator('[data-testid="chat-action-card"]').last();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.getByText("E2E 系统公告")).toBeVisible();
  await card.locator('[data-testid="chat-action-confirm"]').click();

  // 结果回执（system 消息）
  await expect(page.getByText("操作成功").last()).toBeVisible({
    timeout: 20_000
  });
  // 公告确已落库（title icontains 过滤可查；双浏览器共享库允许存在历史同名公告）
  const list = await jsonRequest(
    page,
    "get",
    "/api/notifications/notice-messages?title=E2E"
  );
  expect(list.code).toBe(1000);
  expect(JSON.stringify(list.data)).toContain("E2E 系统公告");
});

test("AI 受限动作：/do 禁用用户 → 确认卡片 → 执行（复用现有用户接口）", async ({
  page
}) => {
  await login(page);
  await enableAiAction(page);

  // 目标用户（API 创建，随机名避免双浏览器共享库冲突）
  const username = `e2e_ai_target_${Date.now()}`;
  const created = await jsonRequest(page, "post", "/api/system/user", {
    username,
    nickname: `AI目标${Date.now() % 100000}`,
    password: "Test@123456"
  });
  expect(created.code).toBe(1000);

  const input = await openAiRoom(page);
  await input.fill(`/do 禁用用户 ${username}`);
  await input.press("Enter");

  // 确认卡片：断言目标用户名（声明式动作，服务端把用户名解析为具体用户）
  const card = page.locator('[data-testid="chat-action-card"]').last();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.getByText(username).first()).toBeVisible();
  await card.locator('[data-testid="chat-action-confirm"]').click();
  await expect(page.getByText("操作成功").last()).toBeVisible({
    timeout: 20_000
  });

  // 落库断言：目标用户 is_active 已置 false（复用既有 PATCH /api/system/user/<pk> 的真实写入）
  const list = await jsonRequest(
    page,
    "get",
    `/api/system/user?username=${username}`
  );
  expect(list.code).toBe(1000);
  expect(JSON.stringify(list.data)).toContain('"is_active":false');
});

test("AI 受限动作：/do 多步串联 → 两张确认卡片逐项执行", async ({ page }) => {
  test.setTimeout(150_000);
  await login(page);
  await enableAiAction(page);

  const input = await openAiRoom(page);
  // 执行基线：每次动作执行写一条 AI:action 审计行（API 查询，双浏览器并行下
  // 计数只增不减，用 >= 基线+2 容忍并行噪声；WS 回执计数在本房间不可靠）
  const auditCount = async () => {
    const res = await jsonRequest(
      page,
      "get",
      "/api/system/logs/operation?module=AI%3Aaction&page_size=1"
    );
    expect(res.code).toBe(1000);
    return Number(res.data?.total ?? 0);
  };
  const beforeAudits = await auditCount();

  await input.fill("/do 串联：发个全体公告，再把我的消息全部标记已读");
  await input.press("Enter");

  // 多草稿契约：一次产出两张确认卡片（action_drafts 逐项渲染，各自独立确认）。
  // 共享库存在历史卡片：按「本 run 唯一的公告标题」过滤后取 .last()（最新一条）。
  const cards = page.locator('[data-testid="chat-action-card"]');
  const publishCard = cards.filter({ hasText: "E2E 串联公告" }).last();
  const readCard = cards.filter({ hasText: "标记全部消息已读" }).last();
  await expect(publishCard).toBeVisible({ timeout: 20_000 });
  await expect(readCard).toBeVisible({ timeout: 20_000 });

  await publishCard.locator('[data-testid="chat-action-confirm"]').click();
  await readCard.locator('[data-testid="chat-action-confirm"]').click();
  await expect
    .poll(auditCount, { timeout: 30_000, intervals: [1_000, 2_000, 5_000] })
    .toBeGreaterThanOrEqual(beforeAudits + 2);

  // 落库断言：串联公告确已发布（title icontains 过滤，共享库允许历史同名）
  const list = await jsonRequest(
    page,
    "get",
    "/api/notifications/notice-messages?title=E2E 串联"
  );
  expect(list.code).toBe(1000);
  expect(JSON.stringify(list.data)).toContain("E2E 串联公告");
});

test("AI 受限动作：/do 查询用户数 → 结果表渲染（dashboard.overview）", async ({
  page
}) => {
  await login(page);
  await enableAiAction(page);

  const input = await openAiRoom(page);
  await input.fill("/do 系统里有多少用户数？");
  await input.press("Enter");

  // 确认卡片 → 确认执行（只读动作）
  const cards = page.locator('[data-testid="chat-action-card"]');
  const card = cards.filter({ hasText: "首页统计" }).last();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.locator('[data-testid="chat-action-confirm"]').click();

  // 结果表渲染（回归：dashboard.overview 曾只显示 detail 文案看不到数据）
  // 执行回执是 system 消息，action_result 挂在回执上 → 结果表跟在回执下方
  const table = page
    .locator('[data-testid="chat-messages"]')
    .locator('[data-testid="ai-result-table"]')
    .last();
  await expect(table).toBeVisible({ timeout: 30_000 });
  await expect(table.getByText("用户数量")).toBeVisible();
  // 用户数量行有真实数值（非空）
  const valueCell = table
    .locator("tr", { hasText: "用户数量" })
    .locator("td")
    .nth(1);
  await expect(valueCell).not.toHaveText("");
});
