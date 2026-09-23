import { BaseApi } from "@/api/base";
import type { BaseResult, DataListResult, DetailResult } from "@/api/types";

/**
 * 安全域接口集合（JumpServer 对标批三）。
 *
 * - accountRiskApi：账号安全风险巡检（F-6）
 * - loginPolicyApi：登录访问策略（F-7）
 * - passkeyApi：Passkey 凭据（F-9，个人凭据；challenge 为登录前匿名端点）
 * - savedViewApi：列表「我的视图」（F-4，个人筛选偏好）
 * - messageTemplateApi：通知消息模板（F-3，配置型端点 save/reset）
 */

/** 处置动作：与后端 system/utils/account_risk.py 的 HANDLE_ACTIONS 同源 */
export type AccountRiskHandleAction =
  | "notify"
  | "force_change_password"
  | "force_logout"
  | "disable"
  | "ignore"
  | "resolve";

export type AccountRiskStats = {
  total: number;
  pending: number;
  by_level: Record<string, number>;
  by_status: Record<string, number>;
  by_type: Array<{ risk_type: string; count: number }>;
  actions: AccountRiskHandleAction[];
};

class AccountRiskApi extends BaseApi {
  scan = () => {
    return this.request<
      DetailResult<{ total: number; created: number; resolved: number }>
    >("post", {}, {}, `${this.baseApi}/scan`);
  };
  stats = (params?: object) => {
    return this.request<DetailResult<AccountRiskStats>>(
      "get",
      params,
      {},
      `${this.baseApi}/stats`
    );
  };
  handle = (
    pk: string | number,
    action: AccountRiskHandleAction,
    remark?: string
  ) => {
    return this.request<DetailResult>(
      "post",
      {},
      { action, remark },
      `${this.baseApi}/${pk}/handle`
    );
  };
  batchHandle = (
    pks: Array<string | number>,
    action: AccountRiskHandleAction,
    remark?: string
  ) => {
    return this.request<
      DetailResult<{
        success: string[];
        failures: Array<{ pk: string; reason: string }>;
      }>
    >("post", {}, { pks, action, remark }, `${this.baseApi}/batch-handle`);
  };
}

export const accountRiskApi = new AccountRiskApi("/api/system/account-risks");

export type LoginPolicyPreviewItem = {
  pk: string;
  name: string;
  priority: number;
  /** 策略动作裸值：accept / reject / require_mfa / record */
  action: string;
  matched: boolean;
  /** 是否为最终生效策略（按优先级首个命中） */
  effective: boolean;
};

export type LoginPolicyPreview = {
  matched: boolean;
  action: string | null;
  policy: string;
  items: LoginPolicyPreviewItem[];
  username?: string;
  ip?: string;
  when?: string;
};

class LoginPolicyApi extends BaseApi {
  preview = (data?: { username?: string; ip?: string; when?: string }) => {
    return this.request<DetailResult<LoginPolicyPreview>>(
      "post",
      {},
      data ?? {},
      `${this.baseApi}/preview`
    );
  };
}

export const loginPolicyApi = new LoginPolicyApi("/api/system/login-policies");

export type PasskeyChallenge = {
  challenge: string;
  rp_id: string;
  user_id: string;
  username: string;
  display_name: string;
};

class PasskeyApi extends BaseApi {
  /** 登录前匿名挑战（凭一次性 mfa_token） */
  loginChallenge = (mfaToken: string) => {
    return this.request<DetailResult<{ challenge: string; rp_id: string }>>(
      "post",
      {},
      { mfa_token: mfaToken },
      "/api/system/login/mfa/passkey/challenge"
    );
  };
  challenge = (scene: "register" | "authenticate" = "register") => {
    return this.request<DetailResult<PasskeyChallenge>>(
      "post",
      {},
      { scene },
      `${this.baseApi}/challenge`
    );
  };
  register = (data: object) => {
    return this.request<DetailResult>(
      "post",
      {},
      data,
      `${this.baseApi}/register`
    );
  };
}

export const passkeyApi = new PasskeyApi("/api/system/passkeys");

class SavedViewApi extends BaseApi {}

export const savedViewApi = new SavedViewApi("/api/system/saved-views");

export type MessageTemplateItem = {
  message_type: string;
  message_type_label: string;
  category: string;
  category_label: string;
  is_system: boolean;
  default_subject: string;
  variables: string[];
  has_override: boolean;
  override: {
    subject_template: string;
    body_template: string;
    is_active: boolean;
    remark: string;
    updated_time: string | null;
  };
};

class MessageTemplateApi extends BaseApi {
  preview = (data: {
    message_type: string;
    subject_template?: string;
    body_template?: string;
  }) => {
    return this.request<
      DetailResult<{
        subject: string;
        message: string;
        variables: Record<string, string>;
      }>
    >("post", {}, data, `${this.baseApi}/preview`);
  };
  save = (data: {
    message_type: string;
    subject_template?: string;
    body_template?: string;
    is_active?: boolean;
    remark?: string;
  }) => {
    return this.request<BaseResult>("post", {}, data, `${this.baseApi}/save`);
  };
  reset = (messageType: string) => {
    return this.request<BaseResult>(
      "post",
      {},
      { message_type: messageType },
      `${this.baseApi}/reset`
    );
  };
  /** 注册表列表（非分页数组，含覆盖状态与可用变量） */
  registry = () => {
    return this.request<DataListResult<MessageTemplateItem>>("get", {}, {});
  };
}

export const messageTemplateApi = new MessageTemplateApi(
  "/api/notifications/message-templates"
);
