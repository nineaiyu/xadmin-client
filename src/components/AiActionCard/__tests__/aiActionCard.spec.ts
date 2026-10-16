import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { describe, expect, it, vi } from "vitest";

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
  "el-tag": {
    name: "ElTag",
    template: '<span class="stub-tag"><slot /></span>'
  },
  "el-button": {
    name: "ElButton",
    emits: ["click"],
    template:
      '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>'
  }
};

const draft = {
  action: "leave.submit",
  label: "请假申请",
  summary: "3 天年假",
  requires_approval: false,
  params: { days: 3, leave_type: "annual", urgent: true, form_id: "f1" }
};

const mountCard = (props: Record<string, unknown> = {}) =>
  mount(Component, {
    props: {
      draft,
      runnable: true,
      executor: vi.fn().mockResolvedValue({ ok: true }),
      ...props
    },
    global: { plugins: [i18n], stubs }
  });

describe("AiActionCard 受限动作草稿卡", () => {
  it("参数明细成行（隐藏 form_id、布尔与枚举走词条）", () => {
    const wrapper = mountCard();
    const text = wrapper.text();
    expect(text).toContain("执行「请假申请」");
    expect(text).toContain("3");
    expect(text).toContain("是");
    expect(text).not.toContain("f1");
  });

  it("需审批草稿打标签", () => {
    const wrapper = mountCard({ draft: { ...draft, requires_approval: true } });
    expect(wrapper.find(".stub-tag").text()).toBe("需审批");
  });

  it("确认执行成功后展示回执并去掉确认按钮", async () => {
    const executor = vi.fn().mockResolvedValue({ ok: true, detail: "已提交" });
    const wrapper = mountCard({ executor });
    await wrapper.get('[data-testid="ai-action-confirm"]').trigger("click");
    expect(executor).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("已提交");
    expect(wrapper.find('[data-testid="ai-action-confirm"]').exists()).toBe(
      false
    );
  });

  it("审批拦截（pending）转重试按钮；失败可重试", async () => {
    const executor = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, pending: true, detail: "待审批" })
      .mockResolvedValueOnce({ ok: false, detail: "后端拒绝了" });
    const wrapper = mountCard({ executor });

    await wrapper.get('[data-testid="ai-action-confirm"]').trigger("click");
    expect(wrapper.text()).toContain("待审批");
    const retry = wrapper.get('[data-testid="ai-action-confirm"]');
    expect(retry.text()).toBe("重试");

    await retry.trigger("click");
    expect(wrapper.text()).toContain("后端拒绝了");
  });

  it("取消后落终态；不可执行时展示禁用提示且无按钮", async () => {
    const cancelled = mountCard();
    await cancelled.get('[data-testid="ai-action-cancel"]').trigger("click");
    expect(cancelled.text()).toContain("已取消");

    const disabled = mountCard({
      runnable: false,
      disabledHint: "没有执行权限",
      testidPrefix: "chat"
    });
    expect(
      disabled.find('[data-testid="chat-action-disabled-hint"]').text()
    ).toBe("没有执行权限");
    expect(disabled.find('[data-testid="chat-action-confirm"]').exists()).toBe(
      false
    );
  });
});
