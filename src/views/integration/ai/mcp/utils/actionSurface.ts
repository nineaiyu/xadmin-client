import type { McpServerItem, McpToolSnapshot } from "@/api/ai/mcp";

/**
 * 工具可调用判定：后端快照的 callable = 服务器启用且工具在白名单内
 * （不含 expose_to_ai）；字段缺失（在途旧后端）时按同一规则前端兜底。
 */
export function isMcpToolCallable(
  server: McpServerItem,
  tool: McpToolSnapshot
): boolean {
  if (typeof tool.callable === "boolean") return tool.callable;
  return Boolean(
    server.enabled &&
    (server.allowed_tools ?? []).includes(tool.name) &&
    tool.input_schema &&
    Object.keys(tool.input_schema).length > 0
  );
}

/**
 * 工具是否已接入 AI 动作面：可调用 **且** 服务器开启 expose_to_ai。
 * 仅 callable 会让「白名单但未暴露」的工具被误标为已接入。
 */
export function isMcpToolInActionSurface(
  server: McpServerItem,
  tool: McpToolSnapshot
): boolean {
  return Boolean(isMcpToolCallable(server, tool) && server.expose_to_ai);
}
