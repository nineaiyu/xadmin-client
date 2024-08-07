import { ViewBaseApi } from "@/api/base";

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
// 注册配置
export const settingsRegisterAuthApi = new ViewBaseApi(
  "/api/settings/register/auth"
);

// 短信
export const settingsSmsServerApi = new ViewBaseApi("/api/settings/sms");

export const settingsSmsBackendsApi = new ViewBaseApi(
  "/api/settings/sms/backend"
);

export const settingsSmsConfigApi = new ViewBaseApi("/api/settings/sms/config");

// 验证码设置
export const settingsVerifyCodeApi = new ViewBaseApi("/api/settings/verify");

// 忘记密码设置
export const settingsResetPasswordCodeApi = new ViewBaseApi(
  "/api/settings/reset/auth"
);
