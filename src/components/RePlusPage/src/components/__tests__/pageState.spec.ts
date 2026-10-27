import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { describe, expect, it } from "vitest";

import PageState from "../PageState.vue";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: {
    "zh-CN": {
      plus: {
        noListPermission: "无查看权限",
        retry: "重试",
        resetAndRetry: "重置筛选并重试"
      },
      reState: { error: "加载失败" }
    }
  }
});

const stubs = {
  ReStateContainer: {
    name: "ReStateContainer",
    props: ["state"],
    template:
      '<div data-testid="state"><slot v-if="state === \'error\'" name="error" /><slot v-else /></div>'
  },
  ElAlert: { template: "<div />" },
  ElButton: {
    name: "ElButton",
    emits: ["click"],
    template: "<button @click=\"$emit('click')\"><slot /></button>"
  }
};

type PageStateProps = {
  state: "denied" | "error" | "ready";
  errorDetail: string;
  canReset?: boolean;
};

const mountState = (props: PageStateProps) =>
  mount(PageState, {
    props,
    global: { plugins: [i18n], stubs }
  });

describe("RePlusPage PageState", () => {
  it("错误态提供重试与重置筛选两个自救入口", async () => {
    const wrapper = mountState({
      state: "error",
      errorDetail: "500",
      canReset: true
    });
    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(2);
    await buttons[0].trigger("click");
    await buttons[1].trigger("click");
    expect(wrapper.emitted("retry")).toHaveLength(1);
    expect(wrapper.emitted("reset")).toHaveLength(1);
  });

  it("未开启 canReset 时只保留重试", () => {
    const wrapper = mountState({ state: "error", errorDetail: "500" });
    expect(wrapper.findAll("button")).toHaveLength(1);
  });

  it("无权限态不渲染错误操作按钮", () => {
    const wrapper = mountState({ state: "denied", errorDetail: "" });
    expect(wrapper.findAll("button")).toHaveLength(0);
  });
});
