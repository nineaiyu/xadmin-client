import { flushPromises, mount } from "@vue/test-utils";
import {
  ElButton,
  ElDescriptions,
  ElDescriptionsItem,
  ElInput,
  ElTable,
  ElTableColumn,
  ElTag
} from "element-plus";
import { describe, expect, it, vi } from "vitest";

import type { McpServerItem, McpToolSnapshot } from "@/api/ai/mcp";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/utils/message", () => ({ message: vi.fn() }));
vi.mock("@/utils/apiError", () => ({
  normalizeError: (error: unknown) => ({
    code: -1,
    data: null,
    detail: String(error)
  })
}));
vi.mock("@/api/ai/mcp", () => ({
  mcpServerApi: { sync: vi.fn(), call: vi.fn() }
}));

import McpToolsDrawer from "./McpToolsDrawer.vue";

const tool = (overrides: Partial<McpToolSnapshot>): McpToolSnapshot =>
  ({
    name: "demo_tool",
    description: "演示工具",
    read_only: true,
    params: [],
    required: [],
    input_schema: { type: "object", properties: {} },
    ...overrides
  }) as McpToolSnapshot;

/** 服务器满足前端镜像准入的全部门槛（启用 + 暴露 + 白名单 + 有 schema） */
const server = (tools: McpToolSnapshot[]): McpServerItem =>
  ({
    pk: "srv-1",
    name: "ops",
    url: "https://mcp.example.com",
    auth_header: "Authorization",
    auth_token_set: true,
    timeout: 10,
    allowed_tools: ["demo_tool", "other_tool"],
    enabled: true,
    expose_to_ai: true,
    tools_snapshot: tools,
    last_synced_time: null,
    last_sync_error: "",
    remark: ""
  }) as McpServerItem;

const mountDrawer = async (item: McpServerItem) => {
  const wrapper = mount(McpToolsDrawer, {
    props: { row: item },
    global: {
      components: {
        ElButton,
        ElDescriptions,
        ElDescriptionsItem,
        ElInput,
        ElTable,
        ElTableColumn,
        ElTag
      }
    }
  });
  await flushPromises();
  return wrapper;
};

/** 逐行读取「动作面」列标签（每行两个 tag：只读 + 动作面，取第二个） */
const surfaceTags = async (wrapper: Awaited<ReturnType<typeof mountDrawer>>) =>
  wrapper
    .findAll("[data-testid='mcp-tools-table'] .el-table__row")
    .map(row => row.findAll(".el-tag").at(-1)?.text());

describe("McpToolsDrawer 工具动作面准入", () => {
  it("条目带 callable 布尔时直接消费后端标记（不重算镜像规则）", async () => {
    // 镜像规则本应为真（启用 + 暴露 + 白名单 + schema），但后端标记 false → false 优先
    const wrapper = await mountDrawer(
      server([
        tool({ name: "demo_tool", callable: false }),
        tool({ name: "other_tool", callable: true })
      ])
    );

    expect(await surfaceTags(wrapper)).toEqual([
      "mcp.actionSurfaceOut",
      "mcp.actionSurfaceIn"
    ]);
  });

  it("条目缺 callable 字段时回落前端镜像规则（兼容在途后端）", async () => {
    const wrapper = await mountDrawer(
      server([
        tool({ name: "demo_tool" }),
        // 不在白名单 → 镜像规则判假
        tool({ name: "other_tool", input_schema: undefined })
      ])
    );

    expect(await surfaceTags(wrapper)).toEqual([
      "mcp.actionSurfaceIn",
      "mcp.actionSurfaceOut"
    ]);
  });
});
