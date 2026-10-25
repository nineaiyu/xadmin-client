import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ back: vi.fn() }));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/api/auth", () => ({
  resetPasswordApi: vi.fn().mockResolvedValue({ code: 1000, data: {} })
}));
vi.mock("@/components/RePlusPage", () => ({ handleOperation: vi.fn() }));
vi.mock("@/store/modules/loginPage", () => ({
  useLoginPageStoreHook: () => ({
    capabilities: { reset: { enabled: false, email: false, sms: false } }
  })
}));
vi.mock("@/components/ReSendVerifyCode", () => ({
  default: { name: "ReSendVerifyCode", template: "<div />" }
}));
vi.mock("../useLoginFlow", async () => {
  const { ref } = await import("vue");
  return {
    backToBasicPage: state.back,
    buildVerifyCodePayload: async () => ({}),
    createPasswordFormRules: () => ({}),
    useAuthInfo: () => ({
      authInfo: ref({ access: false }),
      configLoading: ref(false),
      onConfig: vi.fn()
    }),
    useVerifyCodeSubmit: () => vi.fn()
  };
});

import ResetPassword from "./ResetPassword.vue";

describe("重置密码未开放", () => {
  it("reset.enabled=false：渲染说明与返回入口，不出现空白页", async () => {
    const wrapper = mount(ResetPassword, {
      global: {
        stubs: {
          ElForm: { name: "ElForm", template: "<form><slot /></form>" },
          ElFormItem: { name: "ElFormItem", template: "<div><slot /></div>" },
          ElButton: {
            name: "ElButton",
            emits: ["click"],
            template: "<button @click=\"$emit('click')\"><slot /></button>"
          },
          ElResult: {
            name: "ElResult",
            props: ["title"],
            template:
              "<div class='result-stub'>{{ title }}<slot name='extra' /></div>"
          },
          Motion: { name: "Motion", template: "<div><slot /></div>" },
          PasswordFields: { name: "PasswordFields", template: "<div />" }
        },
        directives: { loading: {} }
      }
    });
    await flushPromises();

    expect(wrapper.find(".result-stub").text()).toContain(
      "login.resetUnavailable"
    );
    await wrapper.find("button").trigger("click");
    expect(state.back).toHaveBeenCalled();
  });
});
