import { expect, test, type Page } from "@playwright/test";

import { FRONT_URL, login, openMenuPath } from "./helpers";

/**
 * 聊天室 AI 流式对话 E2E：思考过程面板 + 增量回答上屏（指向桩 LLM，SSE）。
 *
 * 桩 LLM（scripts/stub_llm.py）对无动作目录标记的请求返回固定回答并产出
 * reasoning 帧；用例经 API 配置档案指向桩（避免 UI 长链路）。
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

async function useStubProfile(page: Page) {
  const saved = await jsonRequest(
    page,
    "patch",
    "/api/system/ai/assistant/config",
    { AI_ASSISTANT_ENABLED: true }
  );
  expect(saved.code).toBe(1000);

  const created = await jsonRequest(page, "post", "/api/system/ai/profiles", {
    name: `E2E-聊天档案-${Date.now()}`,
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
}

test("聊天室 AI 多轮：思考过程 + 流式回答（桩 LLM）", async ({ page }) => {
  await login(page);
  await useStubProfile(page);

  await openMenuPath(page, [], "/default/chat/index");
  await expect(page.locator('[data-testid="chat-page"]')).toBeVisible({
    timeout: 20_000
  });
  await page.locator('[data-testid="chat-room-ai"]').first().click();
  const input = page.locator('[data-testid="chat-input"] textarea');
  await input.waitFor({ state: "visible", timeout: 20_000 });

  await input.fill("你好，介绍一下系统");
  await input.press("Enter");

  // 流式气泡 → 思考面板（reasoning 帧）→ 固定回答增量上屏
  await expect(page.getByTestId("chat-streaming")).toBeVisible({
    timeout: 20_000
  });
  await expect(page.getByTestId("ai-thinking").first()).toBeVisible({
    timeout: 20_000
  });
  await expect(
    page.getByText("这是 E2E 桩 LLM 的固定回答。").first()
  ).toBeVisible({ timeout: 20_000 });
});

test("SSE 增量到达守护：帧必须多次到达（防退化回一次性输出）", async ({
  page
}) => {
  await login(page);
  await useStubProfile(page);

  // 浏览器内 fetch 采样：记录每次 read 到达的时间与累计长度。
  // 背景：StreamingHttpResponse 若用同步生成器，Django 在 ASGI 下会退化为
  // sync_to_async(list)——整个生成器跑完一次性 yield，reads 只有 1~2 次。
  const samples = await page.evaluate(async () => {
    const res = await fetch("/api/chat/ai/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream"
      },
      body: JSON.stringify({ content: "E2E-STREAM-PROBE 请输出长文本" })
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    const reads: Array<{ at: number; length: number }> = [];
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      reads.push({ at: performance.now(), length: text.length });
    }
    return { reads, total: text.length };
  });

  expect(samples.total).toBeGreaterThan(200);
  // 流式：显著多次到达；一次性输出时 reads 仅 1~2 次
  expect(samples.reads.length).toBeGreaterThan(5);
  // 且跨时间推进（桩每帧 10ms，长文本 60+ 帧 → 跨度远超 20ms；
  // 一次性输出则全部在同一毫秒内到达）
  const first = samples.reads[0].at;
  const last = samples.reads[samples.reads.length - 1].at;
  expect(last - first).toBeGreaterThan(20);
});
