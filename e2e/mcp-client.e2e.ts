import { createServer } from "node:http";

import { expect, test } from "@playwright/test";

import { BACKEND_URL, FRONT_URL, getAccessToken, login } from "./helpers";

/**
 * 外部 MCP 服务器（MCP client 侧）用例：配置 → 同步工具 → 白名单调用。
 *
 * 桩 MCP 服务器在本用例进程内起（127.0.0.1 随机端口，Web 后端 loopback 可达）：
 * initialize / notifications/initialized / tools/list / tools/call（echo 走 SSE 响应
 * 承载，覆盖流式解析路径）。
 */

const TOOLS = [
  {
    name: "echo",
    description: "Echo text",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"]
    },
    annotations: { readOnlyHint: true }
  },
  {
    name: "danger",
    description: "Dangerous op",
    inputSchema: { type: "object", properties: {} }
  }
];

function startMcpStub(): Promise<{ url: string; close: () => void }> {
  return new Promise(resolve => {
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", chunk => (body += chunk));
      req.on("end", () => {
        let payload: {
          id?: number;
          method?: string;
          params?: { name?: string; arguments?: Record<string, unknown> };
        } = {};
        try {
          payload = JSON.parse(body || "{}");
        } catch {
          res.writeHead(400, { "Content-Length": "0" });
          res.end();
          return;
        }
        const sendJson = (
          data: unknown,
          extra: Record<string, string> = {}
        ) => {
          const text = JSON.stringify(data);
          res.writeHead(200, {
            "Content-Type": "application/json",
            "Content-Length": String(Buffer.byteLength(text)),
            ...extra
          });
          res.end(text);
        };
        if (payload.method === "notifications/initialized") {
          res.writeHead(202, { "Content-Length": "0" });
          res.end();
          return;
        }
        if (payload.method === "initialize") {
          sendJson(
            {
              jsonrpc: "2.0",
              id: payload.id,
              result: { protocolVersion: "2025-06-18", capabilities: {} }
            },
            { "Mcp-Session-Id": "stub-session" }
          );
          return;
        }
        if (payload.method === "tools/list") {
          sendJson({
            jsonrpc: "2.0",
            id: payload.id,
            result: { tools: TOOLS }
          });
          return;
        }
        if (payload.method === "tools/call") {
          if (payload.params?.name === "echo") {
            const result = {
              content: [
                {
                  type: "text",
                  text: "echo: " + String(payload.params?.arguments?.text ?? "")
                }
              ]
            };
            const line =
              "data: " +
              JSON.stringify({ jsonrpc: "2.0", id: payload.id, result }) +
              "\n\n";
            res.writeHead(200, {
              "Content-Type": "text/event-stream",
              "Content-Length": String(Buffer.byteLength(line))
            });
            res.end(line);
            return;
          }
          sendJson({
            jsonrpc: "2.0",
            id: payload.id,
            error: { code: -32000, message: "unknown tool" }
          });
          return;
        }
        sendJson({
          jsonrpc: "2.0",
          id: payload.id,
          error: { code: -32601, message: "method not found" }
        });
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}/mcp`,
        close: () => server.close()
      });
    });
  });
}

test("外部 MCP 服务器：配置 → 同步工具 → 白名单调用（SSE 结果）", async ({
  page
}) => {
  await login(page);
  const token = await getAccessToken(page);
  const stub = await startMcpStub();
  const suffix = Math.random().toString(36).slice(2, 8);
  const name = `E2E-MCP-${suffix}`;
  let serverPk = "";

  try {
    await page.goto(`${FRONT_URL}/#/integration/ai/mcp`);
    await page.getByRole("button", { name: "新建服务器" }).click();
    const dialog = page.locator(".el-dialog").last();
    await expect(dialog.getByTestId("mcp-form-name")).toBeVisible({
      timeout: 10_000
    });
    // ElInput 把 data-testid 透传到内部 input 元素本身（inheritAttrs:false）：直接 fill
    await dialog.getByTestId("mcp-form-name").fill(name);
    await dialog.getByTestId("mcp-form-url").fill(stub.url);
    await dialog.getByTestId("mcp-form-allowed").fill("echo");
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    const row = page.getByRole("row", { name });
    await expect(row).toBeVisible({ timeout: 15_000 });

    // 服务端主键（用例清理与断言用）
    const listRes = await page.request.get(
      `${BACKEND_URL}/api/ai/mcp-servers?name=${encodeURIComponent(name)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    serverPk = (await listRes.json())?.data?.results?.[0]?.pk ?? "";

    // ---- 同步工具 ----
    await row.getByRole("button", { name: "同步工具" }).click();
    await expect(
      page.locator(".el-message").filter({ hasText: "已同步 2 个工具" }).first()
    ).toBeVisible({ timeout: 15_000 });

    // ---- 工具抽屉：快照清单 + 白名单调用 ----
    await row.getByRole("button", { name: "工具", exact: true }).click();
    const drawer = page.locator(".el-drawer").last();
    await expect(drawer.getByTestId("mcp-tools-table")).toContainText("echo", {
      timeout: 10_000
    });
    await expect(drawer.getByTestId("mcp-tools-table")).toContainText("danger");
    // 令牌未配置提示
    await expect(drawer).toContainText("未配置");

    await drawer
      .getByRole("row", { name: /echo/ })
      .getByRole("button", { name: "调用" })
      .click();
    await drawer.getByTestId("mcp-call-arguments").fill('{"text": "hello"}');
    await drawer.getByTestId("mcp-call-run").click();
    await expect(drawer.getByTestId("mcp-call-result")).toContainText(
      "echo: hello",
      { timeout: 15_000 }
    );
  } finally {
    stub.close();
    if (serverPk) {
      await page.request
        .delete(`${BACKEND_URL}/api/ai/mcp-servers/${serverPk}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        .catch(() => undefined);
    }
  }
});
