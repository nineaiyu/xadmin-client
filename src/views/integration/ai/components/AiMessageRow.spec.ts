import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import {
  ElAvatar,
  ElButton,
  ElCollapseTransition,
  ElIcon,
  ElTable,
  ElTableColumn,
  ElTag
} from "element-plus";

import type {
  AiConsoleMessage,
  NlInterpretResult,
  NlQueryDsl
} from "@/api/ai/ai";
import AiMessageBlock from "@/components/AiMessageBlock/index.vue";
import ChatSystemNotice from "@/components/ChatSystemNotice/index.vue";
import ChatTextBubble from "@/components/ChatTextBubble/index.vue";
import { formatMessageTime } from "@/utils/messageView";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

import AiMessageRow from "./AiMessageRow.vue";

/** 助手消息样本（服务端持久化契约） */
const row = (overrides: Partial<AiConsoleMessage>): AiConsoleMessage =>
  ({
    id: 1,
    feature: "docs",
    role: "assistant",
    content: "回答",
    reasoning: "",
    extra: {},
    created_time: "2026-10-02T10:00:00Z",
    ...overrides
  }) as AiConsoleMessage;

const mountRow = (
  item: AiConsoleMessage,
  props: {
    runnable?: boolean;
    nlRunnable?: boolean;
    nlRunning?: boolean;
  } = {}
) =>
  mount(AiMessageRow, {
    props: {
      item,
      runnable: props.runnable ?? false,
      nlRunnable: props.nlRunnable ?? true,
      nlRunning: props.nlRunning ?? false,
      actionExecutor: vi.fn(async () => ({ ok: true, detail: "" }))
    },
    global: {
      components: {
        ElAvatar,
        ElButton,
        ElCollapseTransition,
        ElIcon,
        ElTable,
        ElTableColumn,
        ElTag
      }
    }
  });

describe("AiMessageRow 单条助手消息", () => {
  it("user 消息主色气泡靠右，assistant 消息带头像靠左，system 消息居中窄条", () => {
    const user = mountRow(row({ role: "user", content: "问题" }));
    expect(user.find(".justify-end").exists()).toBe(true);
    expect(user.findComponent(ChatTextBubble).props("mine")).toBe(true);

    const assistant = mountRow(row({}));
    expect(assistant.find(".justify-end").exists()).toBe(false);
    expect(assistant.findComponent(AiMessageBlock).exists()).toBe(true);

    const system = mountRow(
      row({ role: "system", content: "连接中断", extra: { error: true } })
    );
    expect(system.findComponent(ChatSystemNotice).exists()).toBe(true);
    expect(system.text()).toContain("连接中断");
  });

  it("AI 块透传思考与正文，附时间标签", () => {
    const item = row({ reasoning: "思考链", content: "答案正文" });
    const wrapper = mountRow(item);
    const block = wrapper.findComponent(AiMessageBlock);
    expect(block.props("reasoning")).toBe("思考链");
    expect(block.props("content")).toBe("答案正文");
    // 时间标签走公共格式化口径（本地时区 HH:mm）
    expect(wrapper.text()).toContain(formatMessageTime(item.created_time));
  });

  it("NL 卡渲染查询解释；可操作时提供运行按钮并冒泡 runNl，只读时不提供", async () => {
    const dsl: NlQueryDsl = {
      dataset: "d1",
      mode: "rows",
      filters: [],
      limit: 10
    };
    const nl: NlInterpretResult = {
      dsl,
      dataset_name: "用户表",
      preview_count: 3,
      mode: "rows"
    };

    const runnable = mountRow(row({ extra: { nl } }), { runnable: true });
    expect(runnable.find('[data-testid="ai-nl-card"]').exists()).toBe(true);
    expect(runnable.find('[data-testid="ai-nl-run"]').exists()).toBe(true);
    await runnable.find('[data-testid="ai-nl-run"]').trigger("click");
    expect(runnable.emitted("runNl")).toEqual([[dsl]]);

    const readonly = mountRow(row({ extra: { nl } }), { runnable: false });
    expect(readonly.find('[data-testid="ai-nl-card"]').exists()).toBe(true);
    expect(readonly.find('[data-testid="ai-nl-run"]').exists()).toBe(false);

    const noPerm = mountRow(row({ extra: { nl } }), {
      runnable: true,
      nlRunnable: false
    });
    expect(noPerm.find('[data-testid="ai-nl-run"]').exists()).toBe(false);
  });

  it("动作卡渲染确认卡；runnable=false 时无操作区（历史回看只读）", () => {
    const draft = {
      action: "user.disable",
      label: "禁用用户",
      params: { pk: 3 },
      summary: "",
      requires_approval: false
    };

    const runnable = mountRow(row({ extra: { action_drafts: [draft] } }), {
      runnable: true
    });
    expect(runnable.find('[data-testid="ai-action-card"]').exists()).toBe(true);
    expect(runnable.find('[data-testid="ai-action-confirm"]').exists()).toBe(
      true
    );

    const readonly = mountRow(row({ extra: { action_drafts: [draft] } }), {
      runnable: false
    });
    expect(readonly.find('[data-testid="ai-action-confirm"]').exists()).toBe(
      false
    );
  });

  it("action_result 渲染只读结果表", () => {
    const wrapper = mountRow(
      row({
        extra: {
          action_result: { columns: ["name"], rows: [{ name: "a" }], total: 1 }
        }
      })
    );
    expect(wrapper.find('[data-testid="ai-result-table"]').exists()).toBe(true);
  });

  it("流中断标记渲染部分内容提示", () => {
    const wrapper = mountRow(row({ extra: { partial: "reasoning_only" } }));
    expect(wrapper.text()).toContain("ai.partialHint");
    expect(wrapper.text()).toContain("reasoning_only");
  });
});
