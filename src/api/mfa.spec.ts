import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestMock } = vi.hoisted(() => ({
  requestMock: vi.fn()
}));

vi.mock("@/utils/http", () => ({
  http: { request: requestMock }
}));

import {
  loginMfaSendCodeApi,
  loginMfaVerifyApi,
  mfaApi,
  mfaConfirmApi,
  mfaConfirmInfoApi,
  mfaSendCodeApi,
  otpCloseApi,
  otpConfirmApi,
  otpDisableApi,
  otpOpenApi,
  otpStartApi,
  otpStatusApi,
  otpTestApi,
  recoveryCodesRegenerateApi,
  recoveryCodesStatusApi
} from "./mfa";

/**
 * MFA 薄封装契约测试：逐方法断言「方法 + URL + 载荷」——二次验证、OTP 绑定
 * 管理与登录 MFA 三组端点散落不同前缀，URL 拼错 / 载荷形态漂移时在构建期变红。
 */

describe("mfaApi 二次验证与 OTP 管理", () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it("confirm 组：信息查询（GET 透传查询参数）与提交 / 挑战码（POST）", () => {
    mfaConfirmInfoApi({ confirm_type: "mfa" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/mfa/confirm",
      { params: { confirm_type: "mfa" }, data: undefined },
      {}
    );

    mfaConfirmApi({ method: "otp", code: "123456" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/mfa/confirm",
      { params: {}, data: { method: "otp", code: "123456" } },
      {}
    );

    mfaSendCodeApi({ method: "sms" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/mfa/confirm/send-code",
      { params: {}, data: { method: "sms" } },
      {}
    );
  });

  it("otp 组：无请求体动作的 data 槽位保持 undefined（线上字节级等价）", () => {
    otpStatusApi();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/mfa/otp",
      { params: {}, data: undefined },
      {}
    );

    otpStartApi();
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/mfa/otp/start",
      { params: {}, data: undefined },
      {}
    );

    otpCloseApi();
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/mfa/otp/close",
      { params: {}, data: undefined },
      {}
    );

    otpDisableApi();
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/mfa/otp/disable",
      { params: {}, data: undefined },
      {}
    );

    recoveryCodesStatusApi();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/mfa/otp/recovery-codes",
      { params: {}, data: undefined },
      {}
    );

    recoveryCodesRegenerateApi();
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/mfa/otp/recovery-codes/regenerate",
      { params: {}, data: undefined },
      {}
    );
  });

  it("otp 组：带载荷动作原样透传请求体", () => {
    otpConfirmApi({ code: "123456" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/mfa/otp/confirm",
      { params: {}, data: { code: "123456" } },
      {}
    );

    otpOpenApi({ code: "123456" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/mfa/otp/open",
      { params: {}, data: { code: "123456" } },
      {}
    );

    otpTestApi({ code: "654321" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/mfa/otp/test",
      { params: {}, data: { code: "654321" } },
      {}
    );
  });

  it("登录 MFA 组：挑战码与验证均为匿名 POST", () => {
    loginMfaSendCodeApi({ method: "email", mfa_token: "t1" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/identity/login/mfa/send-code",
      { params: {}, data: { method: "email", mfa_token: "t1" } },
      {}
    );

    loginMfaVerifyApi({ method: "email", code: "654321", mfa_token: "t1" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/identity/login/mfa/verify",
      {
        params: {},
        data: { method: "email", code: "654321", mfa_token: "t1" }
      },
      {}
    );
  });

  it("类实例与命名导出同源（薄委托不另起请求面）", () => {
    expect(mfaApi.confirmInfo).toBeTypeOf("function");
    expect(mfaApi.baseApi).toBe("/api/mfa");
  });
});
