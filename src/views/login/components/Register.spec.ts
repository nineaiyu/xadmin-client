import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  register: vi.fn(),
  message: vi.fn(),
  handleLoginSuccess: vi.fn(),
  buildPayload: vi.fn(),
  loading: null as unknown
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key })
}));
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
  transformI18n: (key: string) => key
}));
vi.mock("@/utils/message", () => ({ message: state.message }));
vi.mock("@/store/modules/user", () => ({
  useUserStoreHook: () => ({ registerByUsername: state.register })
}));
vi.mock("@/store/modules/loginPage", () => ({
  useLoginPageStoreHook: () => ({
    capabilities: {
      register: { enabled: true, email: true, sms: false }
    }
  })
}));
vi.mock("../useLoginFlow", async () => {
  const { ref } = await import("vue");
  state.loading = ref(false);
  return {
    backToBasicPage: () => undefined,
    // 注册提交载荷与密码规则不是本用例的观测点：给最小可用桩
    buildVerifyCodePayload: (...args: unknown[]) => state.buildPayload(...args),
    createPasswordFormRules: () => ({}),
    useAuthInfo: () => ({
      authInfo: { access: true, password: [] },
      configLoading: ref(false),
      onConfig: () => undefined
    }),
    // 提交前置于表单校验：直接返回提交回调，交给按钮点击触发
    useVerifyCodeSubmit: (options: { onSubmit: () => Promise<void> }) =>
      options.onSubmit,
    useLoginFlow: () => ({
      loading: state.loading,
      handleLoginSuccess: state.handleLoginSuccess
    })
  };
});

import Register from "./Register.vue";

const stubs = {
  ElForm: { name: "ElForm", template: "<form><slot /></form>" },
  ElFormItem: { name: "ElFormItem", template: "<div><slot /></div>" },
  ElButton: {
    name: "ElButton",
    emits: ["click"],
    template: "<button @click=\"$emit('click')\"><slot /></button>"
  },
  ElCheckbox: {
    name: "ElCheckbox",
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: "<label><slot /></label>"
  },
  ElResult: { name: "ElResult", template: "<div />" },
  ElDialog: { name: "ElDialog", template: "<div><slot /></div>" },
  Motion: { name: "Motion", template: "<div><slot /></div>" },
  ReSendVerifyCode: { name: "ReSendVerifyCode", template: "<div />" }
};

const mountRegister = () =>
  mount(Register, {
    global: {
      stubs,
      directives: { loading: {} }
    }
  });

/** 勾选隐私政策（提交前置）后点「确定」 */
const submitRegister = async (wrapper: ReturnType<typeof mountRegister>) => {
  await wrapper
    .findComponent({ name: "ElCheckbox" })
    .vm.$emit("update:modelValue", true);
  await wrapper.find('[data-testid="register-submit"]').trigger("click");
  await flushPromises();
};

describe("注册提交", () => {
  beforeEach(() => {
    state.buildPayload.mockResolvedValue({ verify_token: "token" });
    state.message.mockClear();
    state.handleLoginSuccess.mockClear();
    state.register.mockReset();
  });

  it("凭证加密失败：loading 复位并提示，不发起注册请求", async () => {
    state.buildPayload.mockRejectedValue(new Error("crypto unavailable"));

    await submitRegister(mountRegister());

    expect(state.register).not.toHaveBeenCalled();
    expect((state.loading as { value: boolean }).value).toBe(false);
    expect(state.message).toHaveBeenCalledWith("login.registerFailed", {
      type: "error"
    });
  });

  it("业务失败（账号已存在/密码不合规）不提示成功、不跳转，展示后端原因", async () => {
    state.register.mockResolvedValue({
      code: 1002,
      detail: "该账号已存在，请更换其他账号"
    });
    const wrapper = mountRegister();

    await submitRegister(wrapper);

    expect(state.register).toHaveBeenCalledTimes(1);
    expect(state.handleLoginSuccess).not.toHaveBeenCalled();
    expect(state.message).toHaveBeenCalledWith("该账号已存在，请更换其他账号", {
      type: "warning"
    });
    // 失败后按钮可再次点击（loading 必须复位）
    expect((state.loading as { value: boolean }).value).toBe(false);
  });

  it("成功（业务码 1000）才进入统一登录流", async () => {
    state.register.mockResolvedValue({ code: 1000, data: { access: "t" } });
    const wrapper = mountRegister();

    await submitRegister(wrapper);

    expect(state.handleLoginSuccess).toHaveBeenCalledWith("register");
    expect(state.message).not.toHaveBeenCalled();
  });

  it("HTTP 层异常回退到通用失败文案", async () => {
    state.register.mockRejectedValue({ detail: "网络异常" });
    const wrapper = mountRegister();

    await submitRegister(wrapper);

    expect(state.handleLoginSuccess).not.toHaveBeenCalled();
    expect(state.message).toHaveBeenCalledWith("网络异常", { type: "warning" });
    expect((state.loading as { value: boolean }).value).toBe(false);
  });
});
