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
  "el-collapse-transition": {
    name: "ElCollapseTransition",
    template: "<div><slot /></div>"
  }
};

const mountThinking = (props: Record<string, unknown>) =>
  mount(Component, { props, global: { plugins: [i18n], stubs } });

describe("AiThinking 思考面板", () => {
  it("无思考内容且未流式时不渲染", () => {
    const wrapper = mountThinking({});
    expect(wrapper.find(".ai-thinking").exists()).toBe(false);
  });

  it("流式时自动展开 + 运行时标题 + 三点动画", () => {
    const wrapper = mountThinking({ text: "先算一下", streaming: true });
    expect(wrapper.find(".ai-thinking").classes()).toContain("is-running");
    expect(wrapper.text()).toContain("思考中…");
    expect(wrapper.find(".ai-thinking__dots").exists()).toBe(true);
    expect(wrapper.find(".ai-thinking__head").attributes("aria-expanded")).toBe(
      "true"
    );
  });

  it("流式结束自动收起为摘要（字数文案），点击可再次展开", async () => {
    const wrapper = mountThinking({ text: "一二三", streaming: true });
    await wrapper.setProps({ streaming: false });
    expect(wrapper.find(".ai-thinking__head").attributes("aria-expanded")).toBe(
      "false"
    );
    expect(wrapper.text()).toContain("已思考 · 3 字");

    await wrapper.find(".ai-thinking__head").trigger("click");
    expect(wrapper.find(".ai-thinking__head").attributes("aria-expanded")).toBe(
      "true"
    );
  });

  it("历史消息默认折叠，defaultOpen 可强制展开", () => {
    const collapsed = mountThinking({ text: "历史思考" });
    expect(
      collapsed.find(".ai-thinking__head").attributes("aria-expanded")
    ).toBe("false");

    const opened = mountThinking({ text: "历史思考", defaultOpen: true });
    expect(opened.find(".ai-thinking__head").attributes("aria-expanded")).toBe(
      "true"
    );
  });
});
