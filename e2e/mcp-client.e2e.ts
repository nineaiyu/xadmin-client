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
    await page.getByRole("button", { name: "新增", exact: true }).click();
    const dialog = page.locator(".el-dialog:visible").first();
    const formItem = (label: string) =>
      dialog.locator(".el-form-item").filter({ hasText: label }).first();
    const nameInput = formItem("服务器名称").locator("input");
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    // 字段形态：pk 由服务端生成（不得出现可编辑的 ID）、令牌为密码框、
    // 允许工具为逗号文本（不是 JSON 编辑器）
    await expect(
      dialog.locator(".el-form-item__label", { hasText: /^ID:?$/ })
    ).toHaveCount(0);
    await expect(formItem("鉴权令牌").locator("input")).toHaveAttribute(
      "type",
      "password"
    );
    await expect(formItem("允许调用的工具").locator(".jsoneditor")).toHaveCount(
      0
    );
    await nameInput.fill(name);
    await formItem("服务地址").locator("input").fill(stub.url);
    await formItem("允许调用的工具").locator("input").fill("echo");
    const toolOption = page
      .locator(".el-select-dropdown__item")
      .filter({ hasText: "echo" })
      .first();
    await expect(toolOption).toBeVisible({ timeout: 10_000 });
    await toolOption.click();
    // EP 多选下拉选中后常以可见态残留并遮挡下方单选组：点弹窗标题强制收起
    await dialog.locator(".el-dialog__header").click();
    await formItem("接入动作面").getByText("启用", { exact: true }).click();
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
