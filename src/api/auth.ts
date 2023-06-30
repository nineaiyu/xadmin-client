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
  sex: number;
  date_joined: string;
  pk: number;
  mobile: string;
  is_active: boolean;
  roles: number[];
}

export type UserInfoResult = {
  code: number;
  detail: string;
  data: UserInfo;
};

export type TempTokenResult = {
  code: number;
  token: string;
  detail: string;
};

export type CaptchaResult = {
  code: number;
  detail: string;
  captcha_image: string;
  captcha_key: string;
  length: number;
};

/** 登录 */
export const loginApi = (data?: object) => {
  return http.request<TokenResult>("post", "/api/system/login", { data });
};

export const getUserInfoApi = (data?: object) => {
  return http.request<UserInfoResult>("get", "/api/system/userinfo", { data });
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

export const logoutApi = (data?: object) => {
  return http.request<TokenResult>("post", "/api/system/logout", {
    data: data
  });
};
