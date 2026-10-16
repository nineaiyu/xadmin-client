import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import Component from "../index.vue";
import type { AiStreamingBubbleProps } from "../types";

const stubs = {
  AiMessageBlock: {
    name: "AiMessageBlock",
    props: { reasoning: String, content: String, streaming: Boolean },
    template:
      '<div class="stub-block" :data-streaming="String(streaming)">{{ content }}</div>'
  },
  ChatMessageAvatar: {
    name: "ChatMessageAvatar",
    template: '<div class="stub-avatar" />'
  },
  "el-button": {
    name: "ElButton",
    emits: ["click"],
    template:
      '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>'
  }
};

const mountBubble = (
  props: Partial<AiStreamingBubbleProps> &
    Pick<AiStreamingBubbleProps, "testid" | "stopTestid" | "stopLabel">
) => mount(Component, { props, global: { stubs } });

describe("AiStreamingBubble 流式气泡", () => {
  it("按传入 testid 标注容器，透明流式态给内层块", () => {
    const wrapper = mountBubble({
      testid: "chat-streaming",
      stopTestid: "chat-stream-stop",
      stopLabel: "停止生成",
      content: "半句"
    });
    expect(wrapper.find('[data-testid="chat-streaming"]').exists()).toBe(true);
    expect(wrapper.find(".stub-block").attributes("data-streaming")).toBe(
      "true"
    );
  });

  it("停止按钮携带 testid 与文案，点击发出 stop", async () => {
    const wrapper = mountBubble({
      testid: "ai-streaming",
      stopTestid: "ai-stream-stop",
      stopLabel: "停止生成"
    });
    const stop = wrapper.find('[data-testid="ai-stream-stop"]');
    expect(stop.text()).toBe("停止生成");
    await stop.trigger("click");
    expect(wrapper.emitted("stop")).toHaveLength(1);
  });

  it("showName 控制名字行显隐", () => {
    const hidden = mountBubble({
      testid: "t",
      stopTestid: "s",
      stopLabel: "停"
    });
    expect(hidden.text()).not.toContain("AI 助手");

    const shown = mountBubble({
      testid: "t",
      stopTestid: "s",
      stopLabel: "停",
      showName: true,
      nameLabel: "AI 助手"
    });
    expect(shown.text()).toContain("AI 助手");
  });
});
