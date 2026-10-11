import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import Component from "../index.vue";

const ChatMessageListStub = {
  name: "ChatMessageList",
  props: {
    testid: String,
    skeletonTestid: String,
    skeletonVisible: Boolean,
    historyBarVisible: Boolean,
    hasMore: Boolean,
    loadingMore: Boolean,
    emptyVisible: Boolean,
    emptyText: String
  },
  emits: ["scroll", "loadMore", "ready"],
  template: '<div class="stub-list" :data-testid="testid"><slot /></div>'
};

const NewMessagesBadgeStub = {
  name: "NewMessagesBadge",
  props: { count: Number },
  emits: ["jump"],
  template: '<div class="stub-badge">{{ count }}</div>'
};

const stubs = {
  ChatMessageList: ChatMessageListStub,
  NewMessagesBadge: NewMessagesBadgeStub,
  "el-button": {
    name: "ElButton",
    emits: ["click"],
    template:
      '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>'
  }
};

const mountPanel = (props: Record<string, unknown> = {}, slots = {}) =>
  mount(Component, {
    props: {
      title: "会话 A",
      titleTestid: "chat-room-title",
      subtitle: "在线",
      toggleLabel: "会话列表",
      isNarrow: false,
      listTestid: "chat-messages",
      skeletonTestid: "chat-history-skeleton",
      skeletonVisible: false,
      historyBarVisible: true,
      hasMore: false,
      loadingMore: false,
      emptyVisible: false,
      emptyText: "还没有消息",
      pendingCount: 0,
      ...props
    },
    slots,
    global: { stubs }
  });

describe("MessageThreadPanel 消息流面板", () => {
  it("标题按 testid 标注（E2E 以标题判定会话切换完成），副标题同行渲染", () => {
    const wrapper = mountPanel();
    expect(wrapper.find('[data-testid="chat-room-title"]').text()).toBe(
      "会话 A"
    );
    expect(wrapper.text()).toContain("在线");
    expect(wrapper.find('[data-testid="chat-messages"]').exists()).toBe(true);
  });

  it("isNarrow 时显示折叠按钮（带可达名）并发出 toggle", async () => {
    const narrow = mountPanel({ isNarrow: true });
    const toggle = narrow.get("button");
    expect(toggle.attributes("aria-label")).toBe("会话列表");
    await toggle.trigger("click");
    expect(narrow.emitted("toggle")).toHaveLength(1);

    const wide = mountPanel();
    expect(wide.find("button").exists()).toBe(false);
  });

  it("离底计数透传给悬浮条，jump 上抛为 jumpToLatest", async () => {
    const wrapper = mountPanel({ pendingCount: 2 });
    expect(wrapper.find(".stub-badge").text()).toBe("2");
    await wrapper.findComponent(NewMessagesBadgeStub).vm.$emit("jump");
    expect(wrapper.emitted("jumpToLatest")).toHaveLength(1);
  });

  it("滚动元素就绪经 ready 上抛并挂到暴露的 scrollEl 上", () => {
    const wrapper = mountPanel();
    const list = wrapper.findComponent(ChatMessageListStub);
    const element = document.createElement("div");
    list.vm.$emit("ready", element);
    expect(wrapper.emitted("ready")?.[0]?.[0]).toBe(element);
    expect(wrapper.vm.scrollEl).toBe(element);
  });

  it("默认插槽与 composer 插槽分别落在消息区与输入区", () => {
    const wrapper = mountPanel(
      {},
      {
        default: '<div class="row">消息行</div>',
        composer: '<div class="composer">输入区</div>'
      }
    );
    expect(wrapper.find(".stub-list .row").exists()).toBe(true);
    expect(wrapper.find(".composer").exists()).toBe(true);
  });
});
