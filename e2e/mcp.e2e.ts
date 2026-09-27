import { expect, test, type Page } from "@playwright/test";

import { BACKEND_URL, FRONT_URL, login } from "./helpers";

/**
 * MCP（Model Context Protocol）Streamable HTTP 端点 E2E。
 *
 * 端点契约（JSON-RPC 2.0 无状态）：`POST /api/ai/mcp`，PAT 认证——
 * initialize（版本协商）→ tools/list（目录与注册表同源 + annotations）→
 * tools/call（只读动作真实执行 + 未知工具 isError）→ 未知 method -32601。
 *
 * 协议分支由 tests/integration/ai/test_ai_mcp.py 30 例覆盖；本用例把同一
 * 契约钉在真实 HTTP 栈上（ADR-059 前缀、PAT 认证链、AI 门禁、桩 LLM 配置），
 * 防止「单测绿但路由/认证装配漂移」的假绿。
 *
 * AI 配置：与 ai-action.e2e 同源——Setting 打开助手与动作灰度，档案指向
 * playwright webServer 拉起的桩 LLM（scripts/stub_llm.py）并激活。
 * PAT 创建：与 pat.e2e 同源（明文仅展示一次）。
 */

const STUB_LLM_URL =
  process.env.E2E_STUB_LLM_URL ?? "http://127.0.0.1:18897/v1";
const MCP_URL = `${BACKEND_URL}/api/ai/mcp`;

async function jsonRequest(
  page: Page,
  method: "post" | "get" | "patch",
  path: string,
  data?: unknown
) {
  const response = await page.request[method](`${FRONT_URL}${path}`, {
    data: data ?? {}
  });
  return (await response.json()) as {
    code: number;
    data: Record<string, unknown> | null;
  };
}

async function enableAi(page: Page): Promise<void> {
  const saved = await jsonRequest(page, "patch", "/api/ai/assistant/config", {
    AI_ASSISTANT_ENABLED: true,
    AI_ACTION_ENABLED: true
  });
  expect(saved.code).toBe(1000);
  const created = await jsonRequest(page, "post", "/api/ai/profiles", {
    name: `E2E-MCP档案-${Date.now()}`,
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
    `/api/ai/profiles/${pk}/activate`
  );
  expect(activated.code).toBe(1000);
}

/** 创建 PAT 并取明文（与 pat.e2e 同一口径：创建弹层 → 明文一次性展示） */
async function createPat(page: Page, tokenName: string): Promise<string> {
  await page.getByRole("button", { name: "创建令牌" }).first().click();
  const createDialog = page
    .locator(".el-dialog", { hasText: "创建访问令牌" })
    .first();
  await expect(createDialog).toBeVisible({ timeout: 10_000 });
  await createDialog
    .locator(".el-form-item", { hasText: "令牌名称" })
    .locator("input")
    .first()
    .fill(tokenName);
  await createDialog.getByRole("button", { name: "保存" }).click();
  const tokenDialog = page
    .locator(".el-dialog", { hasText: "令牌创建成功" })
    .first();
  await expect(tokenDialog).toBeVisible({ timeout: 15_000 });
  const plainToken =
    (await tokenDialog.locator("code").first().textContent()) ?? "";
  await page.keyboard.press("Escape");
  await expect(tokenDialog).not.toBeVisible({ timeout: 10_000 });
  return plainToken;
}

async function rpc(
  page: Page,
  method: string,
  params: unknown,
  headers?: Record<string, string>
) {
  const payload: Record<string, unknown> = { jsonrpc: "2.0", id: 1, method };
  if (params !== undefined) {
    payload.params = params;
  }
  const response = await page.request.post(MCP_URL, {
    data: payload,
    headers
  });
  const status = response.status();
  const body = await response.json().catch(() => null);
  return { status, body };
}

test("MCP 端点：PAT 认证 → initialize → tools/list → tools/call → 协议错误", async ({
  page
}) => {
  await login(page);
  await enableAi(page);

  // PAT 创建（个人中心 → 访问令牌）
  await page.goto("/#/account-settings");
  await page.locator(".el-menu-item", { hasText: "访问令牌" }).first().click();
  const plainToken = await createPat(page, `e2e-mcp-${Date.now()}`);
  expect(plainToken.startsWith("pat_")).toBeTruthy();
  const headers = { Authorization: `Pat ${plainToken}` };

  // 未认证请求拒绝（全站认证链同口径）
  const anon = await rpc(page, "initialize", { protocolVersion: "2025-03-26" });
  expect([401, 403]).toContain(anon.status);

  // initialize：协议版本协商 + 服务端标识
  const init = await rpc(
    page,
    "initialize",
    { protocolVersion: "2025-03-26" },
    headers
  );
  expect(init.status).toBe(200);
  expect(init.body?.result?.protocolVersion).toBe("2025-03-26");
  expect(init.body?.result?.serverInfo?.name).toBe("xadmin");
  expect(init.body?.result?.capabilities?.tools).toBeTruthy();

  // tools/list：目录非空且条目契约完整（inputSchema / annotations / _meta）
  const list = await rpc(page, "tools/list", {}, headers);
  expect(list.status).toBe(200);
  const tools = list.body?.result?.tools ?? [];
  expect(tools.length).toBeGreaterThan(0);
  for (const tool of tools.slice(0, 3)) {
    expect(tool.inputSchema).toBeTruthy();
    expect(typeof tool.annotations.readOnlyHint).toBe("boolean");
    expect(typeof tool._meta["x-requires-approval"]).toBe("boolean");
  }

  // tools/call：只读动作以当前用户身份真实执行
  const call = await rpc(
    page,
    "tools/call",
    { name: "monitor.overview", arguments: {} },
    headers
  );
  expect(call.body?.result?.isError).toBe(false);
  const content = JSON.parse(call.body?.result?.content?.[0]?.text ?? "{}");
  expect(content.ok).toBe(true);

  // 未知工具：isError 而非协议错误
  const unknownTool = await rpc(
    page,
    "tools/call",
    { name: "user.destroy_all", arguments: {} },
    headers
  );
  expect(unknownTool.body?.result?.isError).toBe(true);

  // 未知 method：JSON-RPC -32601
  const badMethod = await rpc(page, "no/such/method", {}, headers);
  expect(badMethod.body?.error?.code).toBe(-32601);
});
