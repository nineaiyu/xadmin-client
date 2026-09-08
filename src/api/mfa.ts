import { http } from "@/utils/http";
import type { TokenInfo } from "@/api/auth";

/** 验证方式元数据（由后端按全局配置与用户可用性下发，文案已含翻译） */
export interface MfaMethod {
  /** 方式名：otp / sms / email / password */
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
}

/** 登录 MFA 验证结果（data 即 TokenInfo，签发正式 JWT） */
export interface LoginMfaVerifyResult {
  code: number;
  detail: string;
  data: TokenInfo;
}

/** 获取敏感操作二次验证的可用方式与确认状态 */
export const mfaConfirmInfoApi = (params?: object) => {
  return http.request<MfaConfirmMethodResult>("get", "/api/mfa/confirm", {
    params
  });
};

/** 提交二次验证（验证通过后有效期内免重复验证） */
export const mfaConfirmApi = (data?: object) => {
  return http.request<MfaConfirmResult>("post", "/api/mfa/confirm", { data });
};

/** 发送挑战验证码（短信/邮件） */
export const mfaSendCodeApi = (data?: object) => {
  return http.request<{ code: number; detail: string }>(
    "post",
    "/api/mfa/confirm/send-code",
    { data }
  );
};

/** 获取 OTP 绑定状态 */
export const otpStatusApi = () => {
  return http.request<{ code: number; detail: string; data: OtpStatus }>(
    "get",
    "/api/mfa/otp"
  );
};

/** 发起 OTP 绑定：获取候选密钥与 otpauth URI */
export const otpStartApi = () => {
  return http.request<OtpStartResult>("post", "/api/mfa/otp/start");
};

/** 确认 OTP 绑定（校验动态码后写入，自动开启登录二次验证） */
export const otpConfirmApi = (data?: object) => {
  return http.request<{ code: number; detail: string }>(
    "post",
    "/api/mfa/otp/confirm",
    { data }
  );
};

/** 关闭登录二次验证（敏感操作：保留密钥，重新开启无需重新扫码；未二次验证时返回 412 走全局验证弹窗） */
export const otpCloseApi = () => {
  return http.request<{ code: number; detail: string }>(
    "post",
    "/api/mfa/otp/close"
  );
};

/** 重新开启登录二次验证（已绑定密钥时校验一次动态码即可，无需重新扫码） */
export const otpOpenApi = (data?: object) => {
  return http.request<{ code: number; detail: string }>(
    "post",
    "/api/mfa/otp/open",
    { data }
  );
};

/** 校验已绑定密钥的动态码是否正确（不改变任何状态，失败计入防爆破锁定） */
export const otpTestApi = (data?: object) => {
  return http.request<{ code: number; detail: string }>(
    "post",
    "/api/mfa/otp/test",
    { data }
  );
};

/** 解绑 OTP（敏感操作：需先通过二次验证，未验证时返回 412 走全局验证弹窗；密钥将被清除，重新开启需重新扫码） */
export const otpDisableApi = () => {
  return http.request<{ code: number; detail: string }>(
    "post",
    "/api/mfa/otp/disable"
  );
};

/** 发送登录 MFA 挑战验证码（匿名，凭 mfa_token） */
export const loginMfaSendCodeApi = (data?: object) => {
  return http.request<{ code: number; detail: string }>(
    "post",
    "/api/system/login/mfa/send-code",
    { data }
  );
};

/** 登录 MFA 验证：通过后签发正式 JWT */
export const loginMfaVerifyApi = (data?: object) => {
  return http.request<LoginMfaVerifyResult>(
    "post",
    "/api/system/login/mfa/verify",
    { data }
  );
};
