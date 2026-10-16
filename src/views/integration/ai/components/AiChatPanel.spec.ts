import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import {
  ElAvatar,
  ElButton,
  ElCollapseTransition,
  ElEmpty,
  ElIcon,
  ElImage,
  ElInput,
  ElPopover,
  ElTable,
  ElTableColumn,
  ElTag
} from "element-plus";

import type {
  AiConsoleMessage,
  NlInterpretResult,
  NlQueryDsl
} from "@/api/ai/ai";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

import AiChatPanel from "./AiChatPanel.vue";
import AiMessageRow from "./AiMessageRow.vue";

/** 面板消息分组行（与组件 props 同构） */
type MessageGroup =
  | { type: "divider"; key: string; label: string }
  | { type: "message"; key: string; item: AiConsoleMessage };

const consoleMessage = (
  overrides: Partial<AiConsoleMessage>
): AiConsoleMessage =>
  ({
    id: 1,
    feature: "nl",
    role: "assistant",
    content: "",
    reasoning: "",
    extra: {},
    created_time: "2026-10-02T10:00:00Z",
    ...overrides
  }) as AiConsoleMessage;

const baseProps = () => ({
  title: "数据查询",
  subtitle: "",
  placeholder: "问点什么",
  emptyText: "暂无消息",
  disabled: false,
  loadingHistory: false,
  hasMore: false,
  loadingMore: false,
  groups: [] as never,
  activeStreaming: null,
  streaming: false,
  pendingCount: 0,
  nlRunning: false,
  nlRunnable: true,
  actionExecutor: vi.fn(async () => ({ ok: true, detail: "" })),
  isNarrow: false
});

const mountPanel = (
  overrides: {
    disabled?: boolean;
    streaming?: boolean;
    activeStreaming?: { content: string; reasoning: string } | null;
    groups?: MessageGroup[];
  } = {}
) =>
  mount(AiChatPanel, {
    props: { ...baseProps(), ...overrides },
    global: {
      components: {
        ElAvatar,
        ElButton,
        ElCollapseTransition,
        ElEmpty,
        ElIcon,
        ElImage,
        ElInput,
        ElPopover,
        ElTable,
        ElTableColumn,
        ElTag
      },
      stubs: { AiStreamingBubble: true }
    }
  });

describe("AiChatPanel 助手右栏挂载冒烟", () => {
  it("关键 testid 就位：ai-ask-input 透传为 el-input 的 textarea 本体", () => {
    const wrapper = mountPanel();

    expect(wrapper.find('[data-testid="ai-messages"]').exists()).toBe(true);
    const ask = wrapper.find('[data-testid="ai-ask-input"]');
    // 挂点形态契约：data-testid 挂 el-input 本体，属性透传到内部 textarea
    // （e2e 直接对该 testid fill；挂外层 div 会被判为不可编辑元素）
    expect(ask.exists()).toBe(true);
    expect(ask.element.tagName).toBe("TEXTAREA");
    expect(wrapper.find('[data-testid="ai-send"]').exists()).toBe(true);
    // 非流式态：停止按钮不出现
    expect(wrapper.find('[data-testid="ai-stop"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="ai-panel-title"]').text()).toBe(
      "数据查询"
    );
  });

  it("流式进行中：发送按钮切换为停止按钮，点击 emit stop", async () => {
    const wrapper = mountPanel({
      streaming: true,
      activeStreaming: { content: "增量", reasoning: "思考" }
    });
    expect(wrapper.find('[data-testid="ai-stop"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="ai-send"]').exists()).toBe(false);

    await wrapper.find('[data-testid="ai-stop"]').trigger("click");
    expect(wrapper.emitted("stop")).toHaveLength(1);
  });

  it("Enter 与发送按钮 emit send（去除空白），发送后草稿清空", async () => {
    const wrapper = mountPanel();
    const textarea = wrapper.find('[data-testid="ai-ask-input"]');
    await textarea.setValue("  近 7 天登录数 ");
    await textarea.trigger("keydown.enter");
    expect(wrapper.emitted("send")).toEqual([["近 7 天登录数"]]);
    expect(
      (
        wrapper.find('[data-testid="ai-ask-input"]')
          .element as HTMLTextAreaElement
      ).value
    ).toBe("");

    await wrapper.find('[data-testid="ai-ask-input"]').setValue("再来一问");
    await wrapper.find('[data-testid="ai-send"]').trigger("click");
    expect(wrapper.emitted("send")).toEqual([["近 7 天登录数"], ["再来一问"]]);
  });

  it("入口禁用：输入框与发送按钮均不可用", () => {
    const wrapper = mountPanel({ disabled: true });
    expect(
      wrapper.find('[data-testid="ai-ask-input"]').attributes("disabled")
    ).toBeDefined();
    expect(
      wrapper.find('[data-testid="ai-send"]').attributes("disabled")
    ).toBeDefined();
  });

  it("只有最新一条 assistant 消息可操作；NL 卡运行按钮冒泡 runNl 携带 dsl", async () => {
    const dsl: NlQueryDsl = {
      dataset: "d1",
      mode: "rows",
      filters: [],
      limit: 10
    };
    const nl: NlInterpretResult = {
      dsl,
      dataset_name: "用户表",
      preview_count: 1,
      mode: "rows"
    };
    const groups = [
      {
        type: "message" as const,
        key: "m-1",
        item: consoleMessage({ id: 1, role: "user" as const, content: "问" })
      },
      {
        type: "message" as const,
        key: "m-2",
        item: consoleMessage({ id: 2, content: "旧卡", extra: { nl } })
      },
      {
        type: "message" as const,
        key: "m-3",
        item: consoleMessage({
          id: 3,
          role: "user" as const,
          content: "再问"
        })
      },
      {
        type: "message" as const,
        key: "m-4",
        item: consoleMessage({ id: 4, content: "新卡", extra: { nl } })
      }
    ];
    const wrapper = mountPanel({ groups });

    const rows = wrapper.findAllComponents(AiMessageRow);
    expect(rows).toHaveLength(4);
    expect(rows[0].props("runnable")).toBe(false);
    expect(rows[1].props("runnable")).toBe(false);
    expect(rows[2].props("runnable")).toBe(false);
    expect(rows[3].props("runnable")).toBe(true);

    await wrapper.find('[data-testid="ai-nl-run"]').trigger("click");
    expect(wrapper.emitted("runNl")).toEqual([[dsl]]);
  });
});
