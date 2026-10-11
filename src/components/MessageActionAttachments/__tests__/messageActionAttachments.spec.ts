import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import Component from "../index.vue";
import type { AiActionDraft } from "@/api/ai/ai";

/** 最小草稿：只关心 action 的分组渲染，其余字段按契约补全 */
const draftOf = (action: string): AiActionDraft => ({
  action,
  label: action,
  params: {},
  summary: "",
  requires_approval: false
});

const stubs = {
  AiActionCard: {
    name: "AiActionCard",
    props: { draft: Object, runnable: Boolean, testidPrefix: String },
    template: '<div class="stub-card">{{ draft.action }}</div>'
  },
  AiResultTable: {
    name: "AiResultTable",
    props: { data: Object },
    template: '<div class="stub-result">{{ Object.keys(data).length }} 项</div>'
  }
};

const baseProps = {
  runnable: true,
  executor: () => Promise.resolve({ ok: true })
};

describe("MessageActionAttachments 消息内嵌动作", () => {
  it("无 extra 时不渲染任何内容", () => {
    const wrapper = mount(Component, {
      props: { ...baseProps, extra: null },
      global: { stubs }
    });
    expect(wrapper.text()).toBe("");
    expect(wrapper.find(".stub-card").exists()).toBe(false);
    expect(wrapper.find(".stub-result").exists()).toBe(false);
  });

  it("action_drafts 多步草稿逐项渲染，testid 前缀透传", () => {
    const wrapper = mount(Component, {
      props: {
        ...baseProps,
        extra: {
          action_drafts: [draftOf("leave.submit"), draftOf("user.create")]
        },
        testidPrefix: "chat"
      },
      global: { stubs }
    });
    const cards = wrapper.findAllComponents({ name: "AiActionCard" });
    expect(cards).toHaveLength(2);
    expect(cards[0].text()).toBe("leave.submit");
    expect(cards[0].props("testidPrefix")).toBe("chat");
  });

  it("单草稿形态（action_draft）同样成卡", () => {
    const wrapper = mount(Component, {
      props: {
        ...baseProps,
        extra: { action_draft: draftOf("notice.send") }
      },
      global: { stubs }
    });
    expect(wrapper.findAllComponents({ name: "AiActionCard" })).toHaveLength(1);
  });

  it("action_result 非空时渲染只读结果表", () => {
    const empty = mount(Component, {
      props: { ...baseProps, extra: { action_result: {} } },
      global: { stubs }
    });
    expect(empty.find(".stub-result").exists()).toBe(false);

    const withData = mount(Component, {
      props: { ...baseProps, extra: { action_result: { total: 1 } } },
      global: { stubs }
    });
    expect(withData.find(".stub-result").text()).toBe("1 项");
  });
});
