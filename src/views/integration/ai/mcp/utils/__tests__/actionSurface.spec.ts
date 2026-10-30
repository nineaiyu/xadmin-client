import { describe, expect, it } from "vitest";
import type { McpServerItem, McpToolSnapshot } from "@/api/ai/mcp";
import { isMcpToolCallable, isMcpToolInActionSurface } from "../actionSurface";

const server = (overrides: Partial<McpServerItem> = {}) =>
  ({
    pk: "s1",
    enabled: true,
    expose_to_ai: true,
    allowed_tools: ["search"],
    ...overrides
  }) as McpServerItem;

const tool = (overrides: Partial<McpToolSnapshot> = {}) =>
  ({
    name: "search",
    input_schema: { type: "object", properties: {} },
    callable: true,
    ...overrides
  }) as McpToolSnapshot;

describe("MCP 工具动作面标记", () => {
  it("expose_to_ai=false 时即使可调用也未接入动作面", () => {
    const host = server({ expose_to_ai: false });
    expect(isMcpToolCallable(host, tool())).toBe(true);
    expect(isMcpToolInActionSurface(host, tool())).toBe(false);
  });

  it("可调用且已暴露时进入动作面", () => {
    const host = server();
    expect(isMcpToolInActionSurface(host, tool())).toBe(true);
  });

  it("不可调用的工具一律不算动作面", () => {
    const host = server();
    expect(isMcpToolInActionSurface(host, tool({ callable: false }))).toBe(
      false
    );
  });

  it("旧后端无 callable 字段时按启用 + 白名单 + schema 兜底", () => {
    const host = server();
    expect(isMcpToolCallable(host, tool({ callable: undefined }))).toBe(true);
    expect(
      isMcpToolCallable(
        server({ enabled: false }),
        tool({ callable: undefined })
      )
    ).toBe(false);
    expect(
      isMcpToolCallable(
        server({ allowed_tools: [] }),
        tool({ callable: undefined })
      )
    ).toBe(false);
  });
});
