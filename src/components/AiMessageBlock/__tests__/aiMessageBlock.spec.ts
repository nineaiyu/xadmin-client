import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { describe, expect, it } from "vitest";

import Component from "../index.vue";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: {
    "zh-CN": {
      ai: {
        thinkingRunning: "思考中…",
        thinkingDone: "已思考 · {count} 字",
        sources: "参考来源",
        resultName: "名称",
        resultValue: "值",
        resultRows: "共 {count} 行，展示 {shown} 行"
      },
      chat: {
        loadMore: "加载更早",
        noMoreHistory: "没有更多历史消息",
        actionCardTitle: "执行「{label}」",
        actionConfirm: "确认执行",
        actionCancel: "取消",
        actionRetry: "重试",
        actionDone: "执行完成",
        actionPending: "已提交审批",
        actionCancelled: "已取消",
        actionNeedApproval: "需审批",
        yes: "是",
        no: "否"
      },
      reState: { empty: "暂无数据", error: "加载失败" },
      apiScope: { other: "其他" }
    }
  }
});

const stubs = {
  AiThinking: {
    name: "AiThinking",
    props: { text: String, streaming: Boolean },
    template:
      '<div class="stub-thinking" :data-streaming="String(streaming)">{{ text }}</div>'
  }
};

const mountBlock = (props: Record<string, unknown>) =>
  mount(Component, { props, global: { plugins: [i18n], stubs } });

describe("AiMessageBlock AI 回复块", () => {
  it("有思考时渲染思考面板（正文已有内容时思考面板不再处于运行态）", () => {
    const wrapper = mountBlock({
      reasoning: "想一下",
      content: "答案",
      streaming: true
    });
    const thinking = wrapper.find(".stub-thinking");
    expect(thinking.exists()).toBe(true);
    expect(thinking.attributes("data-streaming")).toBe("false");
    expect(wrapper.find(".ai-message__text").text()).toBe("答案");
    expect(wrapper.find(".ai-message__cursor").exists()).toBe(true);
  });

  it("无思考且等待首字：展示三点等待动画", () => {
    const wrapper = mountBlock({ streaming: true });
    expect(wrapper.find(".ai-message__pending").exists()).toBe(true);
    expect(wrapper.find(".ai-message__dots").exists()).toBe(true);
    expect(wrapper.text()).toContain("思考中…");
  });

  it("有思考且等待首字：等待动画让位于思考面板（不再重复「思考中」）", () => {
    const wrapper = mountBlock({ reasoning: "先想", streaming: true });
    expect(wrapper.find(".ai-message__pending").exists()).toBe(false);
  });

  it("出处按序号渲染标题与路径", () => {
    const wrapper = mountBlock({
      content: "答",
      sources: [{ title: "手册", path: "guide/a.md", chunk_index: 0 }]
    });
    expect(wrapper.text()).toContain("参考来源");
    expect(wrapper.text()).toContain("[1] 手册 (guide/a.md)");
  });
});
