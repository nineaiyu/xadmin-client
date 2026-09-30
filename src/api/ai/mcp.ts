import { BaseApi } from "@/api/base";
import type { DetailResult } from "@/api/types";

/** 外部 MCP 服务器（MCP client 侧）：工具同步快照 + 白名单调用 */

/** 工具快照条目（后端只保留展示字段：名称/描述/只读标注/参数名） */
export type McpToolSnapshot = {
  name: string;
  description: string;
  read_only: boolean;
  params: string[];
  required: string[];
};

export type McpServerItem = {
  pk: string;
  name: string;
  url: string;
  auth_header: string;
  auth_token_set: boolean;
  timeout: number;
  /** 调用白名单（空 = 全部禁止，fail-closed） */
  allowed_tools: string[];
  enabled: boolean;
  tools_snapshot: McpToolSnapshot[];
  last_synced_time: string | null;
  last_sync_error: string;
  remark: string;
  creator?: { pk?: string; username?: string } | null;
  created_time?: string;
  updated_time?: string;
};

export type McpServerPayload = {
  name: string;
  url: string;
  auth_header?: string;
  /** 明文只进不出；编辑时留空表示保持不变 */
  auth_token?: string;
  timeout?: number;
  allowed_tools?: string[];
  enabled?: boolean;
  remark?: string;
};

export type McpCallResult = {
  tool: string;
  is_error: boolean;
  text: string;
};

class McpServerApi extends BaseApi {
  /** 同步工具清单（initialize → tools/list），结果落服务器快照 */
  sync = (pk: string) => {
    return this.request<
      DetailResult<{ tools: McpToolSnapshot[]; count: number }>
    >("post", {}, {}, `${this.baseApi}/${pk}/sync`);
  };

  /** 调用白名单内工具（结果文本截断回传） */
  call = (pk: string, tool: string, args: Record<string, unknown>) => {
    return this.request<DetailResult<McpCallResult>>(
      "post",
      {},
      { tool, arguments: args },
      `${this.baseApi}/${pk}/call`
    );
  };
}

export const mcpServerApi = new McpServerApi("/api/ai/mcp-servers");
