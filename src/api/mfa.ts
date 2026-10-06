import { BaseApi } from "@/api/base";
import type { TokenInfo } from "@/api/auth";

/** 验证方式元数据（由后端按全局配置与用户可用性下发，文案已含翻译） */
export interface MfaMethod {
  /** 方式名：otp / sms / email / password / passkey / recovery（恢复码自救通道） */
  name: string;
  display_name: string;
  placeholder: string;
  /** true：服务端先下发验证码（短信/邮件），需要先调 send-code */
  challenge_required: boolean;
}

export interface MfaConfirmMethodResult {
  code: number;
  detail: string;
  data: {
    confirm_type: string;
    methods: MfaMethod[];
    /** 当前确认状态是否已满足该验证类型（TTL 内） */
    confirmed: boolean;
    /** 确认状态到期时间戳（秒），未验证为 null */
    expire_at: number | null;
  };
}

export interface MfaConfirmResult {
  code: number;
  detail: string;
  data: {
    /** 确认到期时间戳（秒） */
    expire_at: number | null;
  };
}

export interface OtpStatus {
  /** 登录二次验证开关是否打开（mfa_level=ENABLED 且已绑定密钥） */
  enabled: boolean;
  /** 是否已绑定 OTP 密钥（关闭开关后密钥保留，bound 仍为 true） */
  bound: boolean;
  phone: string;
  email: string;
}

export interface OtpStartResult {
  code: number;
  detail: string;
  data: {
    /** OTP 密钥（手动输入备用） */
    secret: string;
    /** otpauth URI，用于渲染二维码 */
    uri: string;
  };
}

/** 密码登录返回 `mfa_required` 时的载荷（此时不含 access/refresh） */
export interface LoginMfaRequired {
  mfa_required: boolean;
  mfa_token: string;
  methods: MfaMethod[];
  /** 巡检处置联动：管理员要求改密时透传（MFA 通过后进入系统前引导改密） */
  must_change_password?: boolean;
}

/** 登录 MFA 验证结果（data 即 TokenInfo，签发正式 JWT） */
export interface LoginMfaVerifyResult {
  code: number;
  detail: string;
  data: TokenInfo;
}

/** 确认 OTP 绑定（校验动态码后写入，自动开启登录二次验证；data 内含一次性展示的恢复码） */
export interface OtpConfirmResult {
  code: number;
  detail: string;
  data: {
    /** 10 个一次性恢复码，明文仅此响应内出现一次 */
    recovery_codes: string[];
  };
}

/** 恢复码剩余数量 */
export interface RecoveryCodesStatus {
  remaining: number;
}

/**
 * MFA 二次验证与 OTP 绑定管理：端点分散在 mfa/confirm、mfa/otp 与
 * system/login/mfa 之下，动作一律携带完整 URL（this.request 的 url 参数收
 * 完整路径），baseApi 仅作实例化前缀。
 *
 * 无请求体动作的 data 槽位显式传 undefined：保持与原手写形态一致的无请求体
 * 请求（传 {} 会被 axios 序列化出 "{}" 请求体，二者线上字节级不同）。
 */
class MfaApi extends BaseApi {
  /** 获取敏感操作二次验证的可用方式与确认状态 */
  confirmInfo = (params?: object) => {
    return this.request<MfaConfirmMethodResult>(
      "get",
      params,
      undefined,
      "/api/mfa/confirm"
    );
  };

  /** 提交二次验证（验证通过后有效期内免重复验证） */
  confirm = (data?: object) => {
    return this.request<MfaConfirmResult>("post", {}, data, "/api/mfa/confirm");
  };

  /** 发送挑战验证码（短信/邮件） */
  sendCode = (data?: object) => {
    return this.request<{ code: number; detail: string }>(
      "post",
      {},
      data,
      "/api/mfa/confirm/send-code"
    );
  };

  /** 获取 OTP 绑定状态 */
  otpStatus = () => {
    return this.request<{ code: number; detail: string; data: OtpStatus }>(
      "get",
      {},
      undefined,
      "/api/mfa/otp"
    );
  };

  /** 发起 OTP 绑定：获取候选密钥与 otpauth URI */
  otpStart = () => {
    return this.request<OtpStartResult>(
      "post",
      {},
      undefined,
      "/api/mfa/otp/start"
    );
  };

  /** 确认 OTP 绑定（校验动态码后写入，自动开启登录二次验证） */
  otpConfirm = (data?: object) => {
    return this.request<OtpConfirmResult>(
      "post",
      {},
      data,
      "/api/mfa/otp/confirm"
    );
  };

  /** 关闭登录二次验证（敏感操作：保留密钥，重新开启无需重新扫码；未二次验证时返回 412 走全局验证弹窗） */
  otpClose = () => {
    return this.request<{ code: number; detail: string }>(
      "post",
      {},
      undefined,
      "/api/mfa/otp/close"
    );
  };

  /** 重新开启登录二次验证（已绑定密钥时校验一次动态码即可，无需重新扫码） */
  otpOpen = (data?: object) => {
    return this.request<{ code: number; detail: string }>(
      "post",
      {},
      data,
      "/api/mfa/otp/open"
    );
  };

  /** 校验已绑定密钥的动态码是否正确（不改变任何状态，失败计入防爆破锁定） */
  otpTest = (data?: object) => {
    return this.request<{ code: number; detail: string }>(
      "post",
      {},
      data,
      "/api/mfa/otp/test"
    );
  };

  /** 解绑 OTP（敏感操作：需先通过二次验证，未验证时返回 412 走全局验证弹窗；密钥将被清除，重新开启需重新扫码） */
  otpDisable = () => {
    return this.request<{ code: number; detail: string }>(
      "post",
      {},
      undefined,
      "/api/mfa/otp/disable"
    );
  };

  /** 查询剩余恢复码数量（不回显任何码面） */
  recoveryCodesStatus = () => {
    return this.request<{
      code: number;
      detail: string;
      data: RecoveryCodesStatus;
    }>("get", {}, undefined, "/api/mfa/otp/recovery-codes");
  };

  /** 重新生成恢复码（敏感操作：旧码整批作废，明文仅此响应内出现一次；未二次验证时返回 412 走全局验证弹窗） */
  recoveryCodesRegenerate = () => {
    return this.request<{
      code: number;
      detail: string;
      data: RecoveryCodesStatus & { recovery_codes: string[] };
    }>("post", {}, undefined, "/api/mfa/otp/recovery-codes/regenerate");
  };

  /** 发送登录 MFA 挑战验证码（匿名，凭 mfa_token） */
  loginMfaSendCode = (data?: object) => {
    return this.request<{ code: number; detail: string }>(
      "post",
      {},
      data,
      "/api/system/login/mfa/send-code"
    );
  };

  /** 登录 MFA 验证：通过后签发正式 JWT */
  loginMfaVerify = (data?: object) => {
    return this.request<LoginMfaVerifyResult>(
      "post",
      {},
      data,
      "/api/system/login/mfa/verify"
    );
  };
}

export const mfaApi = new MfaApi("/api/mfa");

/* ---------------- 既有命名导出改薄委托：消费方依赖这些函数名，签名与返回类型不变 ---------------- */

/** 获取敏感操作二次验证的可用方式与确认状态 */
export const mfaConfirmInfoApi = (params?: object) =>
  mfaApi.confirmInfo(params);

/** 提交二次验证（验证通过后有效期内免重复验证） */
export const mfaConfirmApi = (data?: object) => mfaApi.confirm(data);

/** 发送挑战验证码（短信/邮件） */
export const mfaSendCodeApi = (data?: object) => mfaApi.sendCode(data);

/** 获取 OTP 绑定状态 */
export const otpStatusApi = () => mfaApi.otpStatus();

/** 发起 OTP 绑定：获取候选密钥与 otpauth URI */
export const otpStartApi = () => mfaApi.otpStart();

/** 确认 OTP 绑定（校验动态码后写入，自动开启登录二次验证；data 内含一次性展示的恢复码） */
export const otpConfirmApi = (data?: object) => mfaApi.otpConfirm(data);

/** 关闭登录二次验证（敏感操作：保留密钥，重新开启无需重新扫码；未二次验证时返回 412 走全局验证弹窗） */
export const otpCloseApi = () => mfaApi.otpClose();

/** 重新开启登录二次验证（已绑定密钥时校验一次动态码即可，无需重新扫码） */
export const otpOpenApi = (data?: object) => mfaApi.otpOpen(data);

/** 校验已绑定密钥的动态码是否正确（不改变任何状态，失败计入防爆破锁定） */
export const otpTestApi = (data?: object) => mfaApi.otpTest(data);

/** 解绑 OTP（敏感操作：需先通过二次验证，未验证时返回 412 走全局验证弹窗；密钥将被清除，重新开启需重新扫码） */
export const otpDisableApi = () => mfaApi.otpDisable();

/** 查询剩余恢复码数量（不回显任何码面） */
export const recoveryCodesStatusApi = () => mfaApi.recoveryCodesStatus();

/** 重新生成恢复码（敏感操作：旧码整批作废，明文仅此响应内出现一次；未二次验证时返回 412 走全局验证弹窗） */
export const recoveryCodesRegenerateApi = () =>
  mfaApi.recoveryCodesRegenerate();

/** 发送登录 MFA 挑战验证码（匿名，凭 mfa_token） */
export const loginMfaSendCodeApi = (data?: object) =>
  mfaApi.loginMfaSendCode(data);

/** 登录 MFA 验证：通过后签发正式 JWT */
export const loginMfaVerifyApi = (data?: object) => mfaApi.loginMfaVerify(data);
