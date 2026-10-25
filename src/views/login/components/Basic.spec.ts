import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  page: vi.fn(),
  /** 能力清单:各用例按需覆写(默认全开) */
  capabilities: {
    access: true,
    lifetime: 1,
    basic: { enabled: true, captcha: false, token: false, encrypted: false },
    code: { enabled: true, email: true, sms: false },
    register: { enabled: true, email: true, sms: false },
    reset: { enabled: true, email: true, sms: false },
    oauth: []
  }
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
  transformI18n: (key: string) => key
}));
vi.mock("@/api/auth", () => ({
  getTempTokenApi: vi.fn().mockResolvedValue({ code: 1000, data: {} })
}));
vi.mock("@/store/modules/user", () => ({
  useUserStoreHook: () => ({ loginByUsername: vi.fn() })
}));
vi.mock("@/store/modules/loginPage", () => ({
  useLoginPageStoreHook: () => ({
    SET_CURRENT_PAGE: state.page,
    capabilities: state.capabilities
  })
}));
vi.mock("@/components/RePlusPage", () => ({ handleOperation: vi.fn() }));
vi.mock("../useLoginFlow", async () => {
  const { ref } = await import("vue");
  return {
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

const mountBasic = () =>
  mount(Basic, { global: { stubs, directives: { loading: {} } } });

describe("账号密码登录关闭", () => {
  it("basic.enabled=false：不渲染空表单提交，给出可读说明并保留其他登录入口", async () => {
    state.capabilities.basic.enabled = false;
    const wrapper = mountBasic();
    await flushPromises();

    expect(wrapper.find(".alert-stub").text()).toBe("login.basicDisabled");
    expect(wrapper.find("input").exists()).toBe(false);
    expect(wrapper.find(".oauth-stub").exists()).toBe(true);
    expect(wrapper.text()).toContain("login.verifyCodeLogin");
    expect(wrapper.text()).toContain("login.register");
    state.capabilities.basic.enabled = true;
  });
});

describe("登录方式入口按能力清单过滤", () => {
  it("验证码通道全关：不渲染「验证码登录」入口按钮", async () => {
    state.capabilities.code.enabled = false;
    const wrapper = mountBasic();
    await flushPromises();

    expect(wrapper.text()).not.toContain("login.verifyCodeLogin");
    expect(wrapper.text()).toContain("login.register");
    state.capabilities.code.enabled = true;
  });

  it("注册关闭：不渲染「注册」入口按钮", async () => {
    state.capabilities.register.enabled = false;
    const wrapper = mountBasic();
    await flushPromises();

    expect(wrapper.text()).toContain("login.verifyCodeLogin");
    expect(wrapper.text()).not.toContain("login.register");
    state.capabilities.register.enabled = true;
  });

  it("重置关闭：不渲染「忘记密码」链接", async () => {
    state.capabilities.reset.enabled = false;
    const wrapper = mountBasic();
    await flushPromises();

    expect(wrapper.text()).not.toContain("login.forget");
    state.capabilities.reset.enabled = true;
  });

  it("登录总开关关闭：整体显示服务禁止,不渲染登录方式切换", async () => {
    state.capabilities.access = false;
    const wrapper = mountBasic();
    await flushPromises();

    expect(wrapper.find(".result-stub").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("login.verifyCodeLogin");
    state.capabilities.access = true;
  });
});
