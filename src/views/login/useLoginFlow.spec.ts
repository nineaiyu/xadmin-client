import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

const {
  pushMock,
  initRouterMock,
  getTopMenuMock,
  setTokenMock,
  messageMock,
  aesEncryptedMock,
  setIsRememberedMock,
  setLoginDayMock,
  routeQuery
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  initRouterMock: vi.fn(),
  getTopMenuMock: vi.fn(),
  setTokenMock: vi.fn(),
  messageMock: vi.fn(),
  aesEncryptedMock: vi.fn(),
  setIsRememberedMock: vi.fn(),
  setLoginDayMock: vi.fn(),
  routeQuery: { redirect: undefined as string | undefined }
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: pushMock }),
  useRoute: () => ({ query: routeQuery })
}));

vi.mock("@/router/utils", () => ({
  initRouter: initRouterMock,
  getTopMenu: getTopMenuMock
}));

vi.mock("@/utils/auth", () => ({
  setToken: setTokenMock
}));

vi.mock("@/utils/message", () => ({
  message: messageMock
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
  transformI18n: (value: string) => value
}));

vi.mock("@/store/modules/loginPage", () => ({
  useLoginPageStoreHook: () => ({
    SET_ISREMEMBERED: setIsRememberedMock,
    SET_LOGINDAY: setLoginDayMock
  })
}));

vi.mock("@/utils/aes", () => ({
  AesEncrypted: aesEncryptedMock
}));

vi.mock("@/utils", () => ({
  passwordRulesCheck: vi.fn()
}));

import {
  buildVerifyCodePayload,
  formatLoginDayList,
  useLoginFlow,
  useRememberLogin
} from "./useLoginFlow";

/** setTimeout 宏任务兜底，冲刷 handleLoginSuccess 内整条 promise 链 */
const flushAsync = () => new Promise<void>(resolve => setTimeout(resolve, 0));

const tokenData = {
  access: "access-1",
  refresh: "refresh-1",
  access_token_lifetime: 100,
  refresh_token_lifetime: 200
};

describe("useLoginFlow 登录流收敛", () => {
  beforeEach(() => {
    pushMock.mockResolvedValue(undefined);
    initRouterMock.mockResolvedValue(undefined);
    getTopMenuMock.mockReturnValue({ path: "/home" });
    aesEncryptedMock.mockImplementation(
      async (key: string, msg: string) => `enc(${key}:${msg})`
    );
    routeQuery.redirect = undefined;
  });

  it("handleLoginSuccess 提示登录成功并跳 redirect 指定地址", async () => {
    const flow = useLoginFlow();
    routeQuery.redirect = "/system/user";
    flow.handleLoginSuccess("login");
    await flushAsync();

    expect(messageMock).toHaveBeenCalledWith("login.loginSuccess", {
      type: "success"
    });
    expect(initRouterMock).toHaveBeenCalledWith(true);
    expect(pushMock).toHaveBeenCalledWith("/system/user");
    expect(flow.disabled.value).toBe(false);
    expect(flow.loading.value).toBe(false);
  });

  it("handleLoginSuccess 需改密时追加 warning 并跳 /settings/basic", async () => {
    const flow = useLoginFlow();
    flow.mustChangePassword.value = true;
    flow.handleLoginSuccess("login");
    await flushAsync();

    expect(messageMock).toHaveBeenCalledWith("forcePassword.tip", {
      type: "warning",
      duration: 6000
    });
    expect(pushMock).toHaveBeenCalledWith("/settings/basic");
  });

  it("handleLoginSuccess 注册成功不触发改密引导，按首菜单跳转", async () => {
    const flow = useLoginFlow();
    flow.mustChangePassword.value = true;
    flow.handleLoginSuccess("register");
    await flushAsync();

    expect(messageMock).toHaveBeenCalledWith("login.registerSuccess", {
      type: "success"
    });
    expect(messageMock).not.toHaveBeenCalledWith(
      "forcePassword.tip",
      expect.anything()
    );
    expect(pushMock).toHaveBeenCalledWith("/home");
  });

  it("handleLoginSuccess 动态路由初始化失败时跳 /error/500 并复位 loading", async () => {
    initRouterMock.mockRejectedValueOnce(new Error("router init failed"));
    const flow = useLoginFlow();
    flow.handleLoginSuccess("login");
    await flushAsync();

    expect(pushMock).toHaveBeenCalledWith("/error/500");
    expect(flow.loading.value).toBe(false);
  });

  it("afterTokenIssued 写入 token、提取改密标记并进入系统", async () => {
    const flow = useLoginFlow();
    flow.afterTokenIssued(
      { ...tokenData, must_change_password: true },
      "login"
    );
    await flushAsync();

    expect(setTokenMock).toHaveBeenCalledWith({
      ...tokenData,
      must_change_password: true
    });
    expect(flow.mustChangePassword.value).toBe(true);
    expect(pushMock).toHaveBeenCalledWith("/settings/basic");
  });

  it("afterTokenIssued 无改密标记时按 redirect 跳转", async () => {
    const flow = useLoginFlow();
    routeQuery.redirect = "/dashboard";
    flow.afterTokenIssued(tokenData);
    await flushAsync();

    expect(setTokenMock).toHaveBeenCalledWith(tokenData);
    expect(flow.mustChangePassword.value).toBe(false);
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("handleMfaBack 清空 MFA 载荷并执行回退钩子", () => {
    const onMfaBack = vi.fn();
    const flow = useLoginFlow({ onMfaBack });
    flow.loginMfaInfo.value = {
      mfa_required: true,
      mfa_token: "mfa-token",
      methods: []
    };
    flow.handleMfaBack();

    expect(flow.loginMfaInfo.value).toBeNull();
    expect(onMfaBack).toHaveBeenCalledTimes(1);

    // 显式传入的回退钩子优先于组合式函数配置
    const inlineBack = vi.fn();
    flow.handleMfaBack(inlineBack);
    expect(inlineBack).toHaveBeenCalledTimes(1);
    expect(onMfaBack).toHaveBeenCalledTimes(1);
  });

  it("formatLoginDayList 由免登录天数推导下拉选项", () => {
    expect(formatLoginDayList(7)).toEqual([1, 4, 7]);
    expect(formatLoginDayList(2)).toEqual([1, 2]);
    expect(formatLoginDayList(14)).toEqual([1, 7, 14]);
    expect(formatLoginDayList(1)).toEqual([1]);
    expect(formatLoginDayList(0)).toEqual([0]);
  });

  it("useRememberLogin 刷新天数选项并同步 loginPage store", async () => {
    const remember = useRememberLogin();
    remember.loginDay.value = 7;
    remember.formatLoginDayOptions();
    expect(remember.loginDayList.value).toEqual([1, 4, 7]);

    remember.syncRememberToStore();
    expect(setIsRememberedMock).toHaveBeenCalledWith(true);
    expect(setLoginDayMock).toHaveBeenCalledWith(7);

    // 勾选变化的 watch 同步
    remember.checked.value = false;
    await nextTick();
    expect(setIsRememberedMock).toHaveBeenLastCalledWith(false);
  });

  it("buildVerifyCodePayload 明文时透传三个字段且不携带 target", async () => {
    const data = await buildVerifyCodePayload(
      { verify_token: "tok", password: "p@ss", verify_code: "123456" },
      { encrypted: false }
    );

    expect(data).toEqual({
      verify_token: "tok",
      password: "p@ss",
      verify_code: "123456"
    });
    expect("target" in data).toBe(false);
    expect(aesEncryptedMock).not.toHaveBeenCalled();
  });

  it("buildVerifyCodePayload 加密时 password 以 verify_token 为密钥，不再携带 target", async () => {
    const data = await buildVerifyCodePayload(
      { verify_token: "tok", password: "p@ss", verify_code: "123456" },
      { encrypted: true }
    );

    expect(data["password"]).toBe("enc(tok:p@ss)");
    expect(aesEncryptedMock).toHaveBeenCalledTimes(1);
    expect(aesEncryptedMock).toHaveBeenCalledWith("tok", "p@ss");
    expect("target" in data).toBe(false);
  });
});
