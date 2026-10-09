import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CallbackPage from "../callback.vue";

/**
 * OAuth 回调落地页单测。
 *
 * 核心回归：登录账号开启 MFA 时，后端返回 `mfa_required + mfa_token + methods`
 * ——本页渲染 LoginMfa 走二次验证完成登录，不再「显示错误并丢弃 mfa_token」
 * 的死路（与密码登录的二次验证载荷同构）。
 */

const state = vi.hoisted(() => ({
  // 与 src/api/system/oauth.ts 的 OAUTH_BIND_FLAG / OAUTH_BIND_FLAG_TTL 保持一致
  // （避免 importOriginal 拉入 locale/router 依赖链，值漂移由 E2E 兜底）
  OAUTH_BIND_FLAG: "oauth-bind-intent",
  OAUTH_BIND_FLAG_TTL: 15 * 60,
  query: {} as Record<string, string>,
  pushMock: vi.fn(),
  callbackMock: vi.fn(),
  setTokenMock: vi.fn(),
  initRouterMock: vi.fn(),
  messageMock: vi.fn()
}));

vi.mock("vue-i18n", () => ({
  // 仅回调页用到的形态：带插值参数时把参数原样拼接，供断言外部输入未被丢弃
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params?.detail != null ? `${key}:${String(params.detail)}` : key
  })
}));
vi.mock("vue-router", () => ({
  useRoute: () => ({ query: state.query }),
  useRouter: () => ({ push: state.pushMock })
}));
vi.mock("@/api/identity/oauth", () => ({
  OAUTH_BIND_FLAG: state.OAUTH_BIND_FLAG,
  OAUTH_BIND_FLAG_TTL: state.OAUTH_BIND_FLAG_TTL,
  oauthApi: { callback: state.callbackMock }
}));
vi.mock("@/api/auth", () => ({}));
vi.mock("@/utils/auth", () => ({ setToken: state.setTokenMock }));
vi.mock("@/router/utils", () => ({ initRouter: state.initRouterMock }));
vi.mock("@/utils/message", () => ({ message: state.messageMock }));
vi.mock("@/views/login/components/LoginMfa.vue", () => ({
  default: {
    name: "LoginMfa",
    props: ["mfaInfo"],
    emits: ["success", "back"],
    template: '<div class="login-mfa-stub">{{ mfaInfo.mfa_token }}</div>'
  }
}));

const mountPage = () =>
  mount(CallbackPage, {
    global: {
      stubs: {
        "el-result": {
          props: ["title", "subTitle"],
          template:
            '<div class="result-stub"><span class="result-title">{{ title }}</span><span class="result-sub-title">{{ subTitle }}</span><slot name="extra" /></div>'
        },
        "el-button": true
      },
      directives: { loading: {} }
    }
  });

beforeEach(() => {
  sessionStorage.clear();
  state.query = {};
  state.pushMock.mockReset().mockResolvedValue(undefined);
  state.callbackMock.mockReset();
  state.setTokenMock.mockReset();
  state.initRouterMock.mockReset().mockResolvedValue(undefined);
  state.messageMock.mockReset();
});

describe("OAuth 回调页 MFA 分支", () => {
  it("mfa_required：渲染 LoginMfa 二次验证，mfa_token 保留传入", async () => {
    state.query = { provider: "github", code: "c1", state: "s1" };
    state.callbackMock.mockResolvedValue({
      code: 1000,
      data: {
        mfa_required: true,
        mfa_token: "mfa-token-1",
        methods: [{ type: "totp" }]
      }
    });
    const wrapper = mountPage();
    await flushPromises();

    const mfa = wrapper.find(".login-mfa-stub");
    expect(mfa.exists()).toBe(true);
    expect(mfa.text()).toBe("mfa-token-1");
    expect(state.setTokenMock).not.toHaveBeenCalled();
  });

  it("MFA 验证成功事件：走与密码登录相同的后置链路（token → 路由 → 主页）", async () => {
    state.query = { provider: "github", code: "c1", state: "s1" };
    state.callbackMock.mockResolvedValue({
      code: 1000,
      data: { mfa_required: true, mfa_token: "mfa-token-1", methods: [] }
    });
    const wrapper = mountPage();
    await flushPromises();

    const mfa = wrapper.findComponent({ name: "LoginMfa" });
    await mfa.vm.$emit("success", { accessToken: "tok" });
    await flushPromises();

    expect(state.setTokenMock).toHaveBeenCalledWith({ accessToken: "tok" });
    expect(state.initRouterMock).toHaveBeenCalledWith(true);
    expect(state.pushMock).toHaveBeenCalledWith("/");
  });

  it("直接签发 token（无 MFA）：原有登录链路不变", async () => {
    state.query = { provider: "github", code: "c1", state: "s1" };
    state.callbackMock.mockResolvedValue({
      code: 1000,
      data: { accessToken: "tok-2" }
    });
    const wrapper = mountPage();
    await flushPromises();

    expect(state.setTokenMock).toHaveBeenCalledWith({ accessToken: "tok-2" });
    expect(state.pushMock).toHaveBeenCalledWith("/");
    expect(wrapper.find(".login-mfa-stub").exists()).toBe(false);
  });

  it("token 带 must_change_password：与密码登录同口径引导到改密页", async () => {
    state.query = { provider: "github", code: "c1", state: "s1" };
    state.callbackMock.mockResolvedValue({
      code: 1000,
      data: { access: "tok-3", must_change_password: true }
    });
    const wrapper = mountPage();
    await flushPromises();

    expect(state.setTokenMock).toHaveBeenCalledWith({
      access: "tok-3",
      must_change_password: true
    });
    expect(state.initRouterMock).toHaveBeenCalledWith(true);
    expect(state.messageMock).toHaveBeenCalledWith("forcePassword.tip", {
      type: "warning",
      duration: 6000
    });
    expect(state.pushMock).toHaveBeenCalledWith("/settings/basic");
    expect(wrapper.find(".login-mfa-stub").exists()).toBe(false);
  });

  it("绑定意图回调：仍然跳转账户设置页签，不进 MFA", async () => {
    sessionStorage.setItem(state.OAUTH_BIND_FLAG, String(Date.now()));
    state.query = { provider: "github", code: "c1", state: "s1" };
    state.callbackMock.mockResolvedValue({ code: 1000, data: { bound: true } });
    const wrapper = mountPage();
    await flushPromises();

    expect(state.pushMock).toHaveBeenCalledWith({
      path: "/account-settings",
      query: { tab: "oauthBindings" }
    });
    expect(wrapper.find(".login-mfa-stub").exists()).toBe(false);
  });
});

describe("OAuth 回调页 IdP error 分支", () => {
  it("IdP 回跳 error + error_description：展示带详情的纯文本失败文案，不请求后端", async () => {
    state.query = {
      provider: "github",
      error: "access_denied",
      error_description: "The user denied the request"
    };
    const wrapper = mountPage();
    await flushPromises();

    expect(state.callbackMock).not.toHaveBeenCalled();
    expect(wrapper.find(".result-stub").exists()).toBe(true);
    expect(wrapper.find(".result-sub-title").text()).toBe(
      "oauth.idpErrorDetail:The user denied the request"
    );
  });

  it("IdP 回跳 error 且无 error_description：展示通用第三方失败文案", async () => {
    state.query = { provider: "github", error: "server_error" };
    const wrapper = mountPage();
    await flushPromises();

    expect(state.callbackMock).not.toHaveBeenCalled();
    expect(wrapper.find(".result-sub-title").text()).toBe("oauth.idpError");
  });
});
