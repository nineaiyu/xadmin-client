import { http } from "@/utils/http";

export interface TokenInfo {
  /** token */
  refresh: string;
  /** `accessToken`的过期时间（时间戳） */
  access_token_lifetime: number;
  refresh_token_lifetime: number;
  /** 用于调用刷新accessToken的接口时所需的token */
  access: string;
}

export type TokenResult = {
  code: number;
  detail: string;
  data: TokenInfo;
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
}

export type UserInfoResult = {
  code: number;
  detail: string;
  data: UserInfo;
  choices_dict?: any[];
  password_rule?: any[];
  config?: { FRONT_END_WEB_WATERMARK_ENABLED: boolean };
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
    password?: Array<any>;
    email?: boolean;
    sms?: boolean;
    basic?: boolean;
    rate?: number;
  };
};

/** 登录 */
export const loginBasicApi = (data?: object) => {
  return http.request<TokenResult>("post", "/api/system/login/basic", { data });
};

export const loginVerifyCodeApi = (data?: object) => {
  return http.request<TokenResult>("post", "/api/system/login/code", { data });
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
