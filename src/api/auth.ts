import { http } from "@/utils/http";
import type { LoginMfaRequired } from "@/api/mfa";

export interface TokenInfo {
  /** token */
  refresh: string;
  /** `accessToken`的过期时间（时间戳） */
  access_token_lifetime: number;
  refresh_token_lifetime: number;
  /** 用于调用刷新accessToken的接口时所需的token */
  access: string;
  /**
   * 巡检处置联动：管理员要求改密时为 true，
   * 前端登录后引导到个人配置页（改密成功由服务端自动清除标记）。
   */
  must_change_password?: boolean;
}

export type TokenResult = {
  code: number;
  detail: string;
  data: TokenInfo;
};

/** 登录接口载荷：正常登录为 TokenInfo；开启登录 MFA 的用户为 mfa_required 引导信息（此时不签发 token） */
export type LoginResultData = TokenInfo | LoginMfaRequired;

export type LoginResult = {
  code: number;
  detail: string;
  data: LoginResultData;
};

/** 密码安全规则：`key` 为规则名，`value` 为阈值/开关 */
export type PasswordRule = {
  value: number;
  key: string;
};

/** choices 接口下发的选项条目（userinfo 等接口的 `choices_dict` 数组项） */
export type ChoiceEntry = {
  value: unknown;
  label?: string;
  disabled?: boolean;
};

export interface UserInfo {
  username: string;
  avatar: string;
  nickname: string;
  email: string;
  last_login: string;
  gender: number;
  date_joined: string;
  pk: number;
  unread_message_count: number;
  phone: string;
  is_active: boolean;
  roles: string[];
  /**
   * 巡检处置联动：管理员要求改密时为 true（随 userinfo 下发），
   * 客户端 App.vue 检测后引导到个人配置页；改密成功由服务端自动清除。
   */
  must_change_password?: boolean;
}

/** 站点水印配置（基本设置下发的三项口径） */
export type SiteWatermarkResultConfig = {
  FRONT_END_WEB_WATERMARK_ENABLED?: boolean;
  /** 自定义文案，留空 = 用户名-昵称-时间 */
  FRONT_END_WEB_WATERMARK_TEXT?: string;
  /** 生效页面路由前缀，逗号分隔，留空 = 全部页面 */
  FRONT_END_WEB_WATERMARK_PATHS?: string;
};

export type UserInfoResult = {
  code: number;
  detail: string;
  data: UserInfo;
  choices_dict?: ChoiceEntry[];
  password_rule?: PasswordRule[];
  config?: SiteWatermarkResultConfig;
};

export type TempTokenResult = {
  code: number;
  token: string;
  detail: string;
  lifetime?: number;
};

export type CaptchaResult = {
  code: number;
  detail: string;
  captcha_image: string;
  captcha_key: string;
  length: number;
};

export type AuthInfoResult = {
  code: number;
  detail: string;
  data: {
    access: boolean;
    captcha?: boolean;
    token?: boolean;
    encrypted?: boolean;
    lifetime?: number;
    reset?: boolean;
    password?: PasswordRule[];
    email?: boolean;
    sms?: boolean;
    basic?: boolean;
    rate?: number;
  };
};

/** 登录 */
export const loginBasicApi = (data?: object) => {
  return http.request<LoginResult>("post", "/api/system/login/basic", { data });
};

export const loginVerifyCodeApi = (data?: object) => {
  return http.request<LoginResult>("post", "/api/system/login/code", { data });
};

export const loginAuthApi = (data?: object) => {
  return http.request<AuthInfoResult>("get", "/api/system/login/basic", {
    data
  });
};

export const getTempTokenApi = () => {
  return http.request<TempTokenResult>("get", "/api/system/auth/token");
};
export const getCaptchaApi = () => {
  return http.request<CaptchaResult>("get", "/api/system/auth/captcha");
};

/** 刷新token */
export const refreshTokenApi = (data?: object) => {
  return http.request<TokenResult>("post", "/api/system/refresh", { data });
};

export const registerApi = (data?: object) => {
  return http.request<TokenResult>("post", "/api/system/register", { data });
};
export const registerAuthApi = (data?: object) => {
  return http.request<AuthInfoResult>("get", "/api/system/register", { data });
};

export const logoutApi = (data?: object) => {
  return http.request<TokenResult>("post", "/api/system/logout", {
    data: data
  });
};

export const rulesPasswordApi = () => {
  return http.request<TokenResult>("get", "/api/system/rules/password");
};

export const resetPasswordApi = (data?: object) => {
  return http.request<TokenResult>("post", "/api/system/auth/reset", {
    data: data
  });
};

/** 邀请令牌预检：`state` = pending / accepted / invalid，不消费令牌 */
export type InviteValidateResult = {
  code: number;
  detail: string;
  data: { state: string; username: string };
};

export const inviteValidateApi = (params?: object) => {
  return http.request<InviteValidateResult>(
    "get",
    "/api/system/auth/invite/validate",
    { params }
  );
};

/** 邀请激活：设置密码完成激活（令牌一次性，激活即失效） */
export const inviteAcceptApi = (data?: object) => {
  return http.request<TokenResult>("post", "/api/system/auth/invite/accept", {
    data
  });
};

export const verifyCodeConfigApi = (params?: object) => {
  return http.request<AuthInfoResult>("get", "/api/system/auth/verify", {
    params
  });
};
export const verifyCodeSendApi = (params?: object, data?: object) => {
  return http.request<TokenResult>("post", "/api/system/auth/verify", {
    params,
    data
  });
};
