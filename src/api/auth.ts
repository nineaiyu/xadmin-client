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

/** 密码安全规则查询结果（匿名可达端点，data 槽位为规则数组） */
export type PasswordRulesResult = {
  code: number;
  detail: string;
  data: { password_rules: PasswordRule[] };
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

/** 统一人机验证题型 / 场景（与后端 captcha.const 的枚举保持一致） */
export type CaptchaType =
  "image" | "slide" | "rotate" | "click" | "pow" | "wordorder" | "icon";
export type CaptchaScene =
  "login" | "register" | "reset" | "bind_email" | "bind_phone" | "invite";

/** 拖动 / 点击采样点：坐标为题目图片的自然像素，t 为毫秒时间戳 */
export type CaptchaTrackPoint = {
  x: number;
  y: number;
  t: number;
  /** 事件类型（move/down/up/click）：信号层用于区分轨迹阶段 */
  ev?: string;
  /** 按下到抬起的时长（毫秒），仅首点携带 */
  dur?: number;
};

export type CaptchaPowChallenge = {
  algorithm: "sha256";
  challenge: string;
  difficulty_bits: number;
  expire: number;
};

export type CaptchaChallengeData = {
  challenge_id: string;
  type: CaptchaType;
  background: string;
  piece?: string;
  tip?: string;
  width?: number;
  height?: number;
  piece_size?: number;
  count?: number;
  /** 图片题答案长度（用于输入提示） */
  length?: number;
  /** 图片题是否提供音频回退 */
  audio?: boolean;
  ttl: number;
  /** 一次性验签会话密钥：verify 需据此加签 */
  ck?: string;
  /** allow / light / 图片回退的算力题面（图片题需随答案一起提交） */
  pow?: CaptchaPowChallenge;
};

export type CaptchaVerifyData = {
  passed: boolean;
  ticket?: string;
  expires_in?: number;
};

export type CaptchaChallengeResult = {
  code: number;
  detail: string;
  data: CaptchaChallengeData;
};

export type CaptchaVerifyResult = {
  code: number;
  detail: string;
  data: CaptchaVerifyData;
  /** 失败语义：captcha_invalid（HTTP 400 时下发，所有失败同形） */
  error?: string;
};

export type AuthInfoResult = {
  code: number;
  detail: string;
  data: {
    access: boolean;
    captcha?: boolean;
    captcha_types?: CaptchaType[];
    captcha_image_fallback?: boolean;
    captcha_flow?: "always" | "adaptive";
    token?: boolean;
    encrypted?: boolean;
    lifetime?: number;
    password?: PasswordRule[];
    email?: boolean;
    sms?: boolean;
    rate?: number;
  };
};

/** 登录页能力清单(GET /api/identity/auth/capabilities):各登录方式入口
 * 可见性的唯一事实源;basic 携带账密登录细节开关,验证码场景的页内细节
 * (发码冷却 / 密码规则等)仍由 verify?category= 承载 */
export type OAuthCapabilityEntry = {
  key: string;
  name: string;
  flavor: string;
};

export type AuthCapabilitiesResult = {
  code: number;
  detail: string;
  data: {
    /** 登录总开关(关闭时登录页整体不可用) */
    access: boolean;
    /** 免登录天数(refresh token 生命周期,天) */
    lifetime: number;
    basic: {
      enabled: boolean;
      captcha: boolean;
      captcha_types: CaptchaType[];
      captcha_image_fallback: boolean;
      captcha_flow?: "always" | "adaptive";
      token: boolean;
      encrypted: boolean;
    };
    code: { enabled: boolean; email: boolean; sms: boolean };
    register: { enabled: boolean; email: boolean; sms: boolean };
    reset: { enabled: boolean; email: boolean; sms: boolean };
    oauth: OAuthCapabilityEntry[];
  };
};

/** 邀请令牌预检：`state` = pending / accepted / invalid，不消费令牌；
 * `encrypted` 为传输加密开关（开启时激活提交的 password 须为密文） */
export type InviteValidateResult = {
  code: number;
  detail: string;
  data: {
    state: string;
    username: string;
    encrypted?: boolean;
    captcha_required?: boolean;
    captcha_types?: CaptchaType[];
    captcha_image_fallback?: boolean;
    captcha_flow?: "always" | "adaptive";
  };
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
      "/api/identity/login/basic"
    );
  };

  /** 验证码登录 */
  loginVerifyCode = (data?: object) => {
    return this.request<LoginResult>(
      "post",
      {},
      data,
      "/api/identity/login/code"
    );
  };

  /** 登录页能力清单(各登录方式入口可用性,登录页外壳一次性拉取) */
  loginCapabilities = () => {
    return this.request<AuthCapabilitiesResult>(
      "get",
      {},
      undefined,
      "/api/identity/auth/capabilities"
    );
  };

  /** 短时效临时令牌（登录页与验证码重发等敏感步骤的前置凭据） */
  tempToken = () => {
    return this.request<TempTokenResult>(
      "get",
      {},
      undefined,
      "/api/identity/auth/token"
    );
  };

  /** 统一人机验证：获取挑战（答案永不下发） */
  captchaChallenge = (data?: object) => {
    return this.request<CaptchaChallengeResult>(
      "post",
      {},
      data,
      "/api/identity/auth/captcha/challenge"
    );
  };

  /** 统一人机验证：校验并换取一次性 ticket */
  captchaVerify = (data?: object) => {
    return this.request<CaptchaVerifyResult>(
      "post",
      {},
      data,
      "/api/identity/auth/captcha/verify"
    );
  };

  /** 刷新token */
  refreshToken = (data?: object) => {
    return this.request<TokenResult>("post", {}, data, "/api/identity/refresh");
  };

  /** 注册 */
  register = (data?: object) => {
    return this.request<TokenResult>(
      "post",
      {},
      data,
      "/api/identity/register"
    );
  };

  /** 登出 */
  logout = (data?: object) => {
    return this.request<TokenResult>("post", {}, data, "/api/identity/logout");
  };

  /** 退出用户模拟：服务端为模拟发起人重签 token（安全阀，模拟态无条件可达） */
  exitImpersonate = (data?: object) => {
    return this.request<TokenResult>(
      "post",
      {},
      data,
      "/api/identity/impersonate/exit"
    );
  };

  /** 密码安全规则查询 */
  passwordRules = () => {
    return this.request<PasswordRulesResult>(
      "get",
      {},
      undefined,
      "/api/identity/rules/password"
    );
  };

  /** 重置密码 */
  resetPassword = (data?: object) => {
    return this.request<TokenResult>(
      "post",
      {},
      data,
      "/api/identity/auth/reset"
    );
  };

  /** 邀请令牌预检（state = pending / accepted / invalid，不消费令牌） */
  inviteValidate = (params?: object) => {
    return this.request<InviteValidateResult>(
      "get",
      params,
      undefined,
      "/api/identity/auth/invite/validate"
    );
  };

  /** 邀请激活：设置密码完成激活（令牌一次性，激活即失效）；
   * 预检下发 encrypted 时 password 为 AesEncrypted(token) 密文 */
  inviteAccept = (data?: object) => {
    return this.request<TokenResult>(
      "post",
      {},
      data,
      "/api/identity/auth/invite/accept"
    );
  };
}

export const authApi = new AuthApi("/api/identity/auth");

/* ---------------- 既有命名导出改薄委托：消费方与测试 mock 依赖这些函数名，签名与返回类型不变 ---------------- */

export const loginBasicApi = (data?: object) => authApi.loginBasic(data);

export const loginVerifyCodeApi = (data?: object) =>
  authApi.loginVerifyCode(data);

export const loginCapabilitiesApi = () => authApi.loginCapabilities();

export const getTempTokenApi = () => authApi.tempToken();
export const captchaChallengeApi = (data?: object) =>
  authApi.captchaChallenge(data);
export const captchaVerifyApi = (data?: object) => authApi.captchaVerify(data);

export const refreshTokenApi = (data?: object) => authApi.refreshToken(data);

export const registerApi = (data?: object) => authApi.register(data);

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
  return http.request<AuthInfoResult>("get", "/api/identity/auth/verify", {
    params
  });
};
export const verifyCodeSendApi = (params?: object, data?: object) => {
  return http.request<TokenResult>("post", "/api/identity/auth/verify", {
    params,
    data
  });
};
