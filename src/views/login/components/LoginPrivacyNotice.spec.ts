import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key })
}));

import LoginPrivacyNotice from "./LoginPrivacyNotice.vue";

/**
 * 弹窗挂载点守护：登录页的隐私弹窗处于 Motion 动画容器内（容器残留 transform，
 * 会让 position:fixed 的遮罩相对该容器定位，弹窗被压成一条），
 * 必须 append-to-body teleport 到 body 才能正常铺满视口。
 */
const ElDialogStub = {
  name: "ElDialog",
  props: {
    modelValue: Boolean,
    appendToBody: Boolean,
    title: String
  },
  emits: ["update:modelValue"],
  template: `
    <div
      class="dialog-stub"
      :data-append-to-body="String(appendToBody)"
      :aria-hidden="String(!modelValue)"
    >
      <slot name="header" />
      <slot />
      <slot name="footer" />
    </div>
  `
};

const mountNotice = () =>
  mount(LoginPrivacyNotice, {
    global: {
      stubs: {
        ElButton: {
          name: "ElButton",
          emits: ["click"],
          template: "<button @click=\"$emit('click')\"><slot /></button>"
        },
        ElDialog: ElDialogStub
      }
    }
  });

describe("登录页隐私提示", () => {
  it("弹窗必须 append-to-body（避免 Motion 残留 transform 压扁 position:fixed 遮罩）", () => {
    const wrapper = mountNotice();
    const dialog = wrapper.find(".dialog-stub");
    expect(dialog.exists()).toBe(true);
    expect(dialog.attributes("data-append-to-body")).toBe("true");
  });

  it("点击《隐私政策》打开弹窗，正文渲染隐私条款，点确定关闭", async () => {
    const wrapper = mountNotice();
    expect(wrapper.find(".dialog-stub").attributes("aria-hidden")).not.toBe(
      "false"
    );

    await wrapper.find("button").trigger("click");
    // v-model 打开后弹窗可见（stub 以 aria-hidden 标记可见性）
    const dialog = wrapper.find(".dialog-stub");
    expect(dialog.attributes("aria-hidden")).toBe("false");
    expect(dialog.text()).toContain("login.privacyPolicyBody");

    await dialog.find("button").trigger("click");
    expect(wrapper.find(".dialog-stub").attributes("aria-hidden")).not.toBe(
      "false"
    );
  });
});
