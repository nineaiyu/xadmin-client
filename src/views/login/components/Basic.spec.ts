import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ page: vi.fn() }));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
  transformI18n: (key: string) => key
}));
vi.mock("@/api/auth", () => ({
  loginAuthApi: vi.fn().mockResolvedValue({ code: 1000, data: {} }),
  getTempTokenApi: vi.fn().mockResolvedValue({ code: 1000, data: {} })
}));
vi.mock("@/store/modules/user", () => ({
  useUserStoreHook: () => ({ loginByUsername: vi.fn() })
}));
vi.mock("@/store/modules/loginPage", () => ({
  useLoginPageStoreHook: () => ({ SET_CURRENT_PAGE: state.page })
}));
vi.mock("@/components/RePlusPage", () => ({ handleOperation: vi.fn() }));
vi.mock("../useLoginFlow", async () => {
  const { ref } = await import("vue");
  return {
    LOGIN_PAGE: { basic: 0, verifyCode: 1, register: 3, resetPassword: 4 },
    operates: [
      { page: 1, title: "login.verifyCodeLogin" },
      { page: 3, title: "login.register" }
    ],
    useAuthInfo: () => ({
      authInfo: ref({ access: true, basic: false, reset: true }),
      configLoading: ref(false),
      onConfig: vi.fn()
    }),
    useRememberLogin: () => ({
      checked: ref(false),
      loginDay: ref(1),
      loginDayList: ref([]),
      formatLoginDayOptions: vi.fn(),
      syncRememberToStore: vi.fn()
    }),
    useEnterSubmit: vi.fn(),
    useLoginFlow: () => ({
      loading: ref(false),
      disabled: ref(false),
      mustChangePassword: ref(false),
      loginMfaInfo: ref(null),
      handleLoginSuccess: vi.fn(),
      afterTokenIssued: vi.fn(),
      handleMfaBack: vi.fn()
    })
  };
});

import Basic from "./Basic.vue";

const stubs = {
  ElForm: { name: "ElForm", template: "<form><slot /></form>" },
  ElFormItem: { name: "ElFormItem", template: "<div><slot /></div>" },
  ElInput: { name: "ElInput", template: "<input />" },
  ElButton: {
    name: "ElButton",
    emits: ["click"],
    template: "<button @click=\"$emit('click')\"><slot /></button>"
  },
  ElAlert: {
    name: "ElAlert",
    props: ["title"],
    template: "<div class='alert-stub'>{{ title }}</div>"
  },
  ElResult: { name: "ElResult", template: "<div class='result-stub' />" },
  Motion: { name: "Motion", template: "<div><slot /></div>" },
  RememberLogin: { name: "RememberLogin", template: "<div />" },
  ReImageVerify: { name: "ReImageVerify", template: "<div />" },
  OAuthEntry: { name: "OAuthEntry", template: "<div class='oauth-stub' />" },
  LoginMfa: { name: "LoginMfa", template: "<div />" }
};

describe("账号密码登录关闭", () => {
  it("basic=false：不渲染空表单提交，给出可读说明并保留其他登录入口", async () => {
    const wrapper = mount(Basic, {
      global: { stubs, directives: { loading: {} } }
    });
    await flushPromises();

    expect(wrapper.find(".alert-stub").text()).toBe("login.basicDisabled");
    expect(wrapper.find("input").exists()).toBe(false);
    expect(wrapper.find(".oauth-stub").exists()).toBe(true);
    expect(wrapper.text()).toContain("login.verifyCodeLogin");
    expect(wrapper.text()).toContain("login.register");
  });
});
