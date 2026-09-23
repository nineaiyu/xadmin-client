import { BaseApi } from "@/api/base";
import type { BaseResult, DetailResult } from "@/api/types";

/**
 * 「本次跳转是绑定」的标记（sessionStorage，值为发起时间戳）。
 *
 * IdP 回跳会整页重载，前端拿不到发起上下文，只能靠跳转前写入的标记区分
 * 登录 / 绑定：回调落地页据此给出「返回账户设置」而不是「返回登录」。
 * 落地页读到即清除，且只认 15 分钟内的标记（用户在 IdP 侧中断留下的
 * 残留标记不应污染后续登录失败的提示）。
 */
export const OAUTH_BIND_FLAG = "oauth-bind-intent";
/** 绑定意图标记的有效期（秒） */
export const OAUTH_BIND_FLAG_TTL = 15 * 60;

/** 登录页可见的第三方 provider（未启用/未配置的不返回） */
export type OAuthProvider = {
  key: string;
  name: string;
  /** 协议类型：oauth2（通用）| oidc（标准 OIDC）| dingtalk | wecom | feishu，本期仅备用字段 */
  flavor?: string;
};

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
  /** 回调落地：code + state → token（或 MFA 引导 / 绑定结果） */
  callback = (provider: string, params: object) => {
    return this.request<DetailResult>(
      "get",
      params,
      {},
      `${this.baseApi}/${provider}/callback`
    );
  };
  /** 已登录用户发起绑定：取带「绑定意图」state 的授权跳转地址 */
  bindAuthorize = (provider: string) => {
    return this.request<DetailResult>(
      "get",
      {},
      {},
      `${this.baseApi}/${provider}/bind-authorize`
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
