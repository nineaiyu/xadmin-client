import { BaseApi, BaseRequest, ViewBaseApi } from "@/api/base";
import type { DetailResult } from "@/api/types";
import type { CaptchaChallengeData } from "@/api/auth";
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

// 验证码总配置（全局开关 + 验证码类型选择）
export const settingsCaptchaGeneralApi = new ViewBaseApi(
  "/api/settings/captcha/general"
);

/** 图片验证码预览（只读，不写挑战缓存） */
export type CaptchaImagePreviewResult = {
  code: number;
  detail: string;
  data: { image: string; length: number };
};

/** 交互式验证码预览（只读，不写挑战缓存/ticket） */
export type CaptchaInteractivePreviewData = Omit<
  CaptchaChallengeData,
  "challenge_id" | "ttl"
>;
export type CaptchaInteractivePreviewResult = {
  code: number;
  detail: string;
  data: CaptchaInteractivePreviewData;
};

class SettingsCaptchaApi extends ViewBaseApi {
  preview = () => {
    return this.request<CaptchaImagePreviewResult>(
      "post",
      {},
      {},
      `${this.baseApi}/preview`
    );
  };
}

class SettingsCaptchaInteractiveApi extends ViewBaseApi {
  preview = (data?: { type?: string }) => {
    return this.request<CaptchaInteractivePreviewResult>(
      "post",
      {},
      data,
      `${this.baseApi}/preview`
    );
  };
}

// 图片验证码设置
export const settingsCaptchaApi = new SettingsCaptchaApi(
  "/api/settings/captcha"
);

// 交互式验证码设置
export const settingsCaptchaInteractiveApi = new SettingsCaptchaInteractiveApi(
  "/api/settings/captcha/interactive"
);

// 验证码观测日志（只读，元数据协议列表）
export const settingsCaptchaLogApi = new BaseApi("/api/settings/captcha/log");

/** 验证码数据大盘（时间窗聚合，只读） */
export type CaptchaStatsSummary = {
  challenge: number;
  verify: number;
  verify_passed: number;
  verify_failed: number;
  consume: number;
  pass_rate: number;
  deny: number;
  deny_rate: number;
  latency_p50: number;
};

export type CaptchaStatsTypeRow = {
  type: string;
  total: number;
  passed: number;
  pass_rate: number;
};

export type CaptchaStatsAssetRow = {
  asset_id: string;
  total: number;
  passed: number;
  pass_rate: number;
};

export type CaptchaStatsDecisionRow = { decision: string; total: number };

export type CaptchaStatsTrendPoint = {
  hour: string;
  total: number;
  passed: number;
};

export type CaptchaStatsPolicy = {
  risk_mode: string;
  log_enabled: boolean;
  retention_days: number;
  thresholds: Record<string, number>;
  pow_enabled: boolean;
  failure_ladder: string;
};

export type CaptchaStatsRiskBucket = { bucket: string; total: number };

export type CaptchaStatsTopReason = { reason: string; total: number };

export type CaptchaStatsTopEntity = {
  ip_hash?: string;
  fp_hash?: string;
  ua_class?: string;
  total: number;
};

export type CaptchaStatsData = {
  window_hours: number;
  generated_at: number;
  policy: CaptchaStatsPolicy;
  summary: CaptchaStatsSummary;
  by_type: CaptchaStatsTypeRow[];
  by_asset: CaptchaStatsAssetRow[];
  by_decision: CaptchaStatsDecisionRow[];
  risk_distribution: CaptchaStatsRiskBucket[];
  top_reasons: CaptchaStatsTopReason[];
  top_ips: CaptchaStatsTopEntity[];
  top_fingerprints: CaptchaStatsTopEntity[];
  top_ua: CaptchaStatsTopEntity[];
  trend: CaptchaStatsTrendPoint[];
  telemetry: Record<string, number>;
};

export type CaptchaStatsResult = {
  code: number;
  detail: string;
  data: CaptchaStatsData;
};

class SettingsCaptchaStatsApi extends BaseRequest {
  stats = (hours = 24) =>
    this.request<CaptchaStatsResult>("get", { hours }, {}, this.baseApi);
}

export const settingsCaptchaStatsApi = new SettingsCaptchaStatsApi(
  "/api/settings/captcha/stats"
);

/** 风险规则（DB 可配分值 / 开关 / 优先级） */
export type CaptchaRule = {
  code: string;
  name: string;
  scope: string;
  score: number;
  enabled: boolean;
  priority: number;
  params: Record<string, unknown>;
};

export type CaptchaRuleResult = {
  code: number;
  detail: string;
  data: CaptchaRule[];
};

class SettingsCaptchaRiskApi extends ViewBaseApi {
  rules = () =>
    this.request<CaptchaRuleResult>("get", {}, {}, `${this.baseApi}/rules`);
  saveRules = (rules: Array<Partial<CaptchaRule> & { code: string }>) =>
    this.request<CaptchaRuleResult>(
      "put",
      {},
      { rules },
      `${this.baseApi}/rules`
    );
}

export const settingsCaptchaRiskApi = new SettingsCaptchaRiskApi(
  "/api/settings/captcha/risk"
);

// 绑定邮箱手机设置
export const settingsBindEmailApi = new ViewBaseApi("/api/settings/bind/email");
export const settingsBindPhoneApi = new ViewBaseApi("/api/settings/bind/phone");

// ip黑名单
export const settingsBlockIpApi = new BaseApi("/api/settings/ip/block");
