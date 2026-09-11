import { BaseApi } from "@/api/base";
import type { BaseResult, DetailResult } from "@/api/types";

/** 登录页可见的第三方 provider（未启用/未配置的不返回） */
export type OAuthProvider = { key: string; name: string };

/** 第三方登录（OAuth2 / OIDC 通用 provider） */
class OAuthApi extends BaseApi {
  providers = () => {
    return this.request<DetailResult>(
      "get",
      {},
      {},
      `${this.baseApi}/providers`
    );
  };
  /** 取 IdP 授权跳转地址（含一次性 state） */
  authorize = (provider: string) => {
    return this.request<DetailResult>(
      "get",
      {},
      {},
      `${this.baseApi}/${provider}/authorize`
    );
  };
  /** 回调落地：code + state → token（或 MFA 引导） */
  callback = (provider: string, params: object) => {
    return this.request<DetailResult>(
      "get",
      params,
      {},
      `${this.baseApi}/${provider}/callback`
    );
  };
  /** 本人绑定列表 */
  bindings = () => {
    return this.request<DetailResult>(
      "get",
      {},
      {},
      `${this.baseApi}/bindings`
    );
  };
  /** 解绑（口令二次确认；最后一种登录方式会被后端拒绝） */
  unbind = (pk: string, password: string) => {
    return this.request<BaseResult>(
      "delete",
      {},
      { password },
      `${this.baseApi}/bindings/${pk}`
    );
  };
}

export const oauthApi = new OAuthApi("/api/system/auth/oauth");
