import { flushPromises, mount } from "@vue/test-utils";
import {
  ElButton,
  ElDrawer,
  ElPagination,
  ElRadioButton,
  ElRadioGroup,
  ElTable,
  ElTableColumn,
  ElTag
} from "element-plus";
import { describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/api/ai/mcp", () => ({
  mcpCallLogApi: { list: (params: unknown) => api.list(params) }
}));
vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string, args?: Record<string, unknown>) =>
      args ? `${key}:${JSON.stringify(args)}` : key
  })
}));
vi.mock("@/utils/message", () => ({ message: vi.fn() }));

import dayjs from "dayjs";
import type { McpServerItem } from "@/api/ai/mcp";
import { message } from "@/utils/message";
import McpCallLogsDrawer from "./McpCallLogsDrawer.vue";

const server: McpServerItem = {
  pk: "srv-1",
  name: "ops",
  url: "https://mcp.example.com",
  auth_header: "",
  auth_token_set: false,
  timeout: 30,
  allowed_tools: ["echo"],
  enabled: true,
  tools_snapshot: [],
  last_synced_time: null,
  last_sync_error: "",
  remark: ""
};

const row = (overrides: Record<string, unknown>) =>
  ({
    pk: "log-1",
    server_name: "ops",
    tool: "echo",
    channel: "",
    ok: true,
    detail: "fine",
    exec_time: 12,
    created_time: "2026-10-25T08:00:00+08:00",
    creator: { pk: "1", username: "admin" },
    ...overrides
  }) as never;

const mountDrawer = async () => {
  const wrapper = mount(McpCallLogsDrawer, {
    props: { server },
    global: {
      components: {
        ElButton,
        ElDrawer,
        ElPagination,
        ElRadioButton,
        ElRadioGroup,
        ElTable,
        ElTableColumn,
        ElTag
      }
    }
  });
  await flushPromises();
  return wrapper;
};

describe("McpCallLogsDrawer", () => {
  it("按服务器拉取流水并渲染行", async () => {
    api.list.mockResolvedValue({
      code: 1000,
      data: { results: [row({}), row({ ok: false, detail: "boom" })], total: 2 }
    });
    const wrapper = await mountDrawer();
    expect(api.list).toHaveBeenCalledWith(
      expect.objectContaining({ object_pk: "srv-1", ordering: "-created_time" })
    );
    const trs = wrapper.findAll(
      '[data-testid="mcp-call-logs-table"] .el-table__row'
    );
    expect(trs).toHaveLength(2);
    expect(trs[1].text()).toContain("boom");
  });

  it("结果过滤切换按 ok 参数重新拉取", async () => {
    api.list.mockResolvedValue({ code: 1000, data: { results: [], total: 0 } });
    const wrapper = await mountDrawer();
    // el-radio-button 的原生 input 才是可 setValue 的控件根
    const failed = wrapper
      .findAll('.el-radio-button input[type="radio"]')
      .at(2)!;
    await failed.setValue(true);
    await flushPromises();
    // 服务端 ok 是布尔过滤器：失败档必须下发 false（字符串会被当空值忽略）
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ ok: false })
    );
  });

  it("渠道翻译：mcp_tool 显示为 AI 动作，空串显示为管理面", async () => {
    api.list.mockResolvedValue({
      code: 1000,
      data: {
        results: [row({ channel: "mcp_tool" }), row({ channel: "" })],
        total: 2
      }
    });
    const wrapper = await mountDrawer();
    const trs = wrapper.findAll(
      '[data-testid="mcp-call-logs-table"] .el-table__row'
    );
    expect(trs[0].text()).toContain("mcp.logChannelAi");
    expect(trs[1].text()).toContain("mcp.logChannelAdmin");
  });

  it("拉取失败：显式提示并清空行（不再呈现为 0 条记录）", async () => {
    api.list.mockResolvedValue({ code: 1003, detail: "无权限查看" });
    const wrapper = await mountDrawer();
    expect(message).toHaveBeenCalledWith("无权限查看", { type: "error" });
    expect(
      wrapper.findAll('[data-testid="mcp-call-logs-table"] .el-table__row')
    ).toHaveLength(0);
  });

  it("网络异常：归一为可读提示", async () => {
    api.list.mockRejectedValue(new Error("Network Error"));
    await mountDrawer();
    expect(message).toHaveBeenCalledWith("Network Error", { type: "error" });
  });

  it("行时间格式化为 MM-DD HH:mm:ss", async () => {
    api.list.mockResolvedValue({
      code: 1000,
      data: { results: [row({})], total: 1 }
    });
    const wrapper = await mountDrawer();
    expect(wrapper.text()).toContain(
      dayjs("2026-10-25T08:00:00+08:00").format("MM-DD HH:mm:ss")
    );
  });
});
