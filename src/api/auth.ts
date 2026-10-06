import { BaseApi } from "@/api/base";
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
   * 平台超管标记（随 userinfo 下发）。客户端用于「非本人也可管理」类入口的
   * 同口径放行（如流程实例讨论区评论删除）；字段缺失时按非超管处理。
   */
  is_superuser?: boolean;
  /**
   * 巡检处置联动：管理员要求改密时为 true（随 userinfo 下发），
   * 客户端 App.vue 检测后引导到个人配置页；改密成功由服务端自动清除。
   */
  must_change_password?: boolean;
  /**
   * 用户模拟态：当前 token 以该用户身份登录（userinfo 下发模拟发起人摘要）。
   * 非模拟态不下发；前端据此渲染顶栏「模拟用户中」横幅，退出后消失。
   */
  impersonator?: ImpersonatorInfo;
}

/** 用户模拟发起人摘要（模拟态 userinfo 下发） */
export interface ImpersonatorInfo {
  pk: number;
  username: string;
  nickname: string;
}

/** 站点水印配置（基本设置下发的口径） */
export type SiteWatermarkResultConfig = {
  FRONT_END_WEB_WATERMARK_ENABLED?: boolean;
  /** 自定义文案，留空 = 用户名-昵称-时间 */
  FRONT_END_WEB_WATERMARK_TEXT?: string;
  /** 生效页面路由前缀，逗号分隔，留空 = 全部页面 */
  FRONT_END_WEB_WATERMARK_PATHS?: string;
  /** 水印字号（像素），缺省 16 */
  FRONT_END_WEB_WATERMARK_FONT_SIZE?: number;
  /** 水印透明度（0.01-1），缺省 0.3 */
  FRONT_END_WEB_WATERMARK_OPACITY?: number;
  /** 水印旋转角度（度），缺省 -10 */
  FRONT_END_WEB_WATERMARK_ROTATE?: number;
  /** 水印文字颜色（十六进制/rgba），留空 = 默认灰 */
  FRONT_END_WEB_WATERMARK_COLOR?: string;
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

/** 邀请令牌预检：`state` = pending / accepted / invalid，不消费令牌 */
export type InviteValidateResult = {
  code: number;
  detail: string;
  data: { state: string; username: string };
};

/**
 * 认证与账号安全接口：端点分散在 login / register / auth / refresh 等路径下，
 * 动作一律携带完整 URL（this.request 的 url 参数收完整路径），baseApi 仅作实例化前缀。
 *
 * 无参 GET 动作的 data 槽位显式传 undefined：保持与原手写形态一致的无请求体 GET
 * （传 {} 会被 axios 序列化出 "{}" 请求体，二者线上字节级不同）。
 */
class AuthApi extends BaseApi {
  /** 登录 */
  loginBasic = (data?: object) => {
    return this.request<LoginResult>(
      "post",
      {},
      data,
      "/api/system/login/basic"
    );
  };

  /** 验证码登录 */
  loginVerifyCode = (data?: object) => {
    return this.request<LoginResult>(
      "post",
      {},
      data,
      "/api/system/login/code"
    );
  };

  /** 登录方式能力探测（data 仅在显式传入时作为请求体） */
  loginAuth = (data?: object) => {
    return this.request<AuthInfoResult>(
      "get",
      {},
      data,
      "/api/system/login/basic"
    );
  };

  /** 短时效临时令牌（登录页与验证码重发等敏感步骤的前置凭据） */
  tempToken = () => {
    return this.request<TempTokenResult>(
      "get",
      {},
      undefined,
      "/api/system/auth/token"
    );
  };

  /** 图形验证码 */
  captcha = () => {
    return this.request<CaptchaResult>(
      "get",
      {},
      undefined,
      "/api/system/auth/captcha"
    );
  };

  /** 刷新token */
  refreshToken = (data?: object) => {
    return this.request<TokenResult>("post", {}, data, "/api/system/refresh");
  };

  /** 注册 */
  register = (data?: object) => {
    return this.request<TokenResult>("post", {}, data, "/api/system/register");
  };

  /** 注册方式能力探测（data 仅在显式传入时作为请求体） */
  registerAuth = (data?: object) => {
    return this.request<AuthInfoResult>(
      "get",
      {},
      data,
      "/api/system/register"
    );
  };

  /** 登出 */
  logout = (data?: object) => {
    return this.request<TokenResult>("post", {}, data, "/api/system/logout");
  };

  /** 退出用户模拟：服务端为模拟发起人重签 token（安全阀，模拟态无条件可达） */
  exitImpersonate = (data?: object) => {
    return this.request<TokenResult>(
      "post",
      {},
      data,
      "/api/system/impersonate/exit"
    );
  };

  /** 密码安全规则查询 */
  passwordRules = () => {
    return this.request<TokenResult>(
      "get",
      {},
      undefined,
      "/api/system/rules/password"
    );
  };

  /** 重置密码 */
  resetPassword = (data?: object) => {
    return this.request<TokenResult>(
      "post",
      {},
      data,
      "/api/system/auth/reset"
    );
  };

  /** 邀请令牌预检（state = pending / accepted / invalid，不消费令牌） */
  inviteValidate = (params?: object) => {
    return this.request<InviteValidateResult>(
      "get",
      params,
      undefined,
      "/api/system/auth/invite/validate"
    );
  };

  /** 邀请激活：设置密码完成激活（令牌一次性，激活即失效） */
  inviteAccept = (data?: object) => {
    return this.request<TokenResult>(
      "post",
      {},
      data,
      "/api/system/auth/invite/accept"
    );
  };
}

export const authApi = new AuthApi("/api/system/auth");

/* ---------------- 既有命名导出改薄委托：消费方与测试 mock 依赖这些函数名，签名与返回类型不变 ---------------- */

export const loginBasicApi = (data?: object) => authApi.loginBasic(data);

export const loginVerifyCodeApi = (data?: object) =>
  authApi.loginVerifyCode(data);

export const loginAuthApi = (data?: object) => authApi.loginAuth(data);

export const getTempTokenApi = () => authApi.tempToken();
export const getCaptchaApi = () => authApi.captcha();

export const refreshTokenApi = (data?: object) => authApi.refreshToken(data);

export const registerApi = (data?: object) => authApi.register(data);
export const registerAuthApi = (data?: object) => authApi.registerAuth(data);

export const logoutApi = (data?: object) => authApi.logout(data);

export const exitImpersonateApi = (data?: object) =>
  authApi.exitImpersonate(data);

export const rulesPasswordApi = () => authApi.passwordRules();

export const resetPasswordApi = (data?: object) => authApi.resetPassword(data);

export const inviteValidateApi = (params?: object) =>
  authApi.inviteValidate(params);

export const inviteAcceptApi = (data?: object) => authApi.inviteAccept(data);

/**
 * 验证码配置 / 发送保留手写调用：BaseRequest.request 会对查询参数做
 * formatParams（空串按「未填写」剔除），而 ReSendVerifyCode 的 category
 * 缺省即 ""（现网发出 ?category= 形态），挂到 this.request 会改变 query
 * 载荷，与线上字节级等价约束冲突，故不入 AuthApi。
 */
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
