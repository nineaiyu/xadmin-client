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
  ReSkeleton: { name: "ReSkeleton", template: '<div class="stub-skeleton" />' },
  ReEmpty: {
    name: "ReEmpty",
    props: { description: String },
    template: '<div class="stub-empty">{{ description }}</div>'
  },
  "el-button": {
    name: "ElButton",
    props: { loading: Boolean },
    emits: ["click"],
    template:
      '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>'
  }
};

const mountList = (props: Record<string, unknown> = {}, slots = {}) =>
  mount(Component, {
    props: {
      testid: "chat-messages",
      skeletonTestid: "chat-history-skeleton",
      skeletonVisible: false,
      historyBarVisible: false,
      hasMore: false,
      loadingMore: false,
      emptyVisible: false,
      emptyText: "还没有消息",
      ...props
    },
    slots,
    global: { plugins: [i18n], stubs }
  });

describe("ChatMessageList 消息列表壳", () => {
  it("按 testid 标注滚动容器，并在挂载时回传滚动元素", () => {
    const wrapper = mountList();
    const container = wrapper.find('[data-testid="chat-messages"]');
    expect(container.exists()).toBe(true);
    const ready = wrapper.emitted("ready");
    expect(ready).toHaveLength(1);
    expect(ready?.[0]?.[0]).toBe(container.element);
  });

  it("骨架占位与空态互斥渲染", () => {
    const skeleton = mountList({ skeletonVisible: true });
    expect(
      skeleton.find('[data-testid="chat-history-skeleton"]').exists()
    ).toBe(true);
    expect(skeleton.find(".stub-empty").exists()).toBe(false);

    const empty = mountList({ emptyVisible: true });
    expect(empty.find(".stub-empty").text()).toBe("还没有消息");
  });

  it("有更多历史时展示加载按钮并发出 loadMore；没有更多时给结论文案", async () => {
    const more = mountList({ historyBarVisible: true, hasMore: true });
    const button = more.get("button");
    expect(button.text()).toBe("加载更早");
    await button.trigger("click");
    expect(more.emitted("loadMore")).toHaveLength(1);

    const done = mountList({ historyBarVisible: true });
    expect(done.text()).toContain("没有更多历史消息");
  });

  it("滚动事件透传给父级", async () => {
    const wrapper = mountList();
    await wrapper.find('[data-testid="chat-messages"]').trigger("scroll");
    expect(wrapper.emitted("scroll")).toHaveLength(1);
  });
});
