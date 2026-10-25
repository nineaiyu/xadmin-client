import { BaseApi, ViewBaseApi } from "@/api/base";
import type { DetailResult } from "@/api/types";
//系统设置
export const settingsApi = new BaseApi("/api/settings/setting");

// 基本配置
export const settingsBasicApi = new ViewBaseApi("/api/settings/basic");

// 密码设置
export const settingsPasswordApi = new ViewBaseApi("/api/settings/password");

// 登录配置
export const settingsLoginLimitApi = new ViewBaseApi(
  "/api/settings/login/limit"
);
export const settingsLoginAuthApi = new ViewBaseApi("/api/settings/login/auth");

// 邮箱配置
export const settingsEmailApi = new ViewBaseApi("/api/settings/email");

// LDAP 目录配置
export const settingsLdapApi = new ViewBaseApi("/api/settings/ldap");

// SCIM 目录同步配置（SystemConfig typed 设置）
class SettingsScimApi extends ViewBaseApi {
  rotateToken = () => {
    return this.request<DetailResult>(
      "post",
      {},
      {},
      `${this.baseApi}/rotate-token`
    );
  };
  syncStatus = () => {
    return this.request<DetailResult>(
      "get",
      {},
      {},
      `${this.baseApi}/sync-status`
    );
  };
}
export const settingsScimApi = new SettingsScimApi("/api/settings/scim");

// 第三方登录 Provider 配置（结构化编辑 + discovery 测试）
class SettingsOAuthProviderApi extends ViewBaseApi {
  testProvider = (provider: object) => {
    return this.request<DetailResult>(
      "post",
      {},
      { provider },
      `${this.baseApi}/test`
    );
  };
}
export const settingsOAuthProviderApi = new SettingsOAuthProviderApi(
  "/api/settings/oauth/providers"
);

// 企业 IM 通知渠道配置
export const settingsNotifyImApi = new ViewBaseApi("/api/settings/notify/im");
// Webhook 通知渠道配置（站点级转发端点）
export const settingsNotifyWebhookApi = new ViewBaseApi(
  "/api/settings/notify/webhook"
);
// 注册配置
export const settingsRegisterAuthApi = new ViewBaseApi(
  "/api/settings/register/auth"
);

// 短信
class SettingsSmsServerApi extends ViewBaseApi {
  backends = (params?: object) => {
    return this.request<DetailResult>(
      "get",
      params,
      {},
      `${this.baseApi}/backends`
    );
  };
}
export const settingsSmsServerApi = new SettingsSmsServerApi(
  "/api/settings/sms"
);

export const settingsSmsConfigApi = new ViewBaseApi("/api/settings/sms/config");

// 验证码设置
export const settingsVerifyCodeApi = new ViewBaseApi("/api/settings/verify");

// MFA 二次验证配置
export const settingsMfaApi = new ViewBaseApi("/api/settings/mfa/auth");

// 资源告警阈值配置
export const settingsMonitorApi = new ViewBaseApi("/api/settings/monitor/auth");

// 忘记密码设置
export const settingsResetPasswordCodeApi = new ViewBaseApi(
  "/api/settings/reset/auth"
);

// 图片验证码设置
export const settingsCaptchaApi = new ViewBaseApi("/api/settings/captcha");

// 绑定邮箱手机设置
export const settingsBindEmailApi = new ViewBaseApi("/api/settings/bind/email");
export const settingsBindPhoneApi = new ViewBaseApi("/api/settings/bind/phone");

// ip黑名单
export const settingsBlockIpApi = new BaseApi("/api/settings/ip/block");
