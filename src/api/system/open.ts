import { BaseApi } from "@/api/base";
import {
  SCOPE_CATALOG_KEYS,
  fetchScopeCatalog,
  type ScopeCatalogResponse
} from "@/utils/scopeDisplay";

/** 开放平台应用：client_id/secret 由服务端生成，明文只在创建与重置时返回一次 */
export interface ApiApplicationItem {
  pk: string;
  name: string;
  client_id: string;
  client_secret_prefix: string;
  scopes: string[];
  ip_allowlist: string[];
  rate_limit_per_minute: number;
  callback_urls: string[];
  token_ttl_seconds: number;
  /** 每日配额（0 = 不限，软告警） */
  daily_quota: number;
  /** 配额告警阈值（百分比，默认 80） */
  quota_alert_percent: number;
  is_active: boolean;
  expired_at: string | null;
  created_time: string;
}

/** 创建/重置密钥响应：附带一次性明文密钥 */
export interface ApiApplicationCredential extends ApiApplicationItem {
  client_secret: string;
  callback_secret: string;
}

/** 响应信封：与 http 层既有 DetailResult 口径一致（含 code/detail） */
export interface ApiApplicationCredentialResult {
  code: number;
  detail?: string;
  data: ApiApplicationCredential;
}

export interface CallbackProbeEnvelope {
  code: number;
  detail?: string;
  data: { results: CallbackProbeResult[] };
}

export interface CallbackProbeResult {
  url: string;
  success: boolean;
  status_code?: number;
  detail?: string;
}

/** 资源授权规则（模型 × 动作 × 字段 × 行，ADR-039 B1） */
export interface ApiApplicationGrant {
  pk?: string;
  /** 模型标签（system.dataset）或 *（全部模型） */
  model: string;
  /** 权限点动作段（list/retrieve/create/...）或 ["*"] */
  actions: string[];
  /** 允许字段（空 = 全部字段） */
  fields: string[];
  /** 行级规则（空 = 不限；结构与后端 data_scope 规则同源） */
  row_filter: RowFilterRule[];
  is_active: boolean;
  description?: string | null;
}

/** 行级规则（table 由所属规则的模型注入，前端不填） */
export interface RowFilterRule {
  field?: string;
  match?: string;
  value?: unknown;
  type?: string;
  exclude?: boolean;
  table?: string;
}

export interface GrantOptionItem {
  value: string;
  label: string;
}

export interface GrantModelOption extends GrantOptionItem {
  actions: GrantOptionItem[];
  fields: GrantOptionItem[];
}

export interface GrantCatalogResponse {
  code: number;
  detail?: string;
  data: { total: number; models: GrantModelOption[] };
}

export interface GrantListResponse {
  code: number;
  detail?: string;
  data: { results: ApiApplicationGrant[] };
}

/** 应用用量报表（ADR-039 B3） */
export interface ApplicationUsageStats {
  days: number;
  total: number;
  failed: number;
  avg_duration: number;
  daily: Array<{
    date: string;
    total: number;
    failed: number;
    avg_duration: number;
  }>;
  top_paths: Array<{ path: string; total: number }>;
  status_codes: Array<{ status_code: number | null; total: number }>;
  quota: { daily_quota: number; alert_percent: number; used_today: number };
}

export interface UsageStatsResponse {
  code: number;
  detail?: string;
  data: ApplicationUsageStats;
}

class ApiApplicationApi extends BaseApi {
  /** 应用资源授权规则（读） */
  grants = (pk: string): Promise<GrantListResponse> =>
    this.request<GrantListResponse>(
      "get",
      {},
      {},
      `${this.baseApi}/${pk}/grants`
    );

  /** 应用资源授权规则（全量替换写） */
  updateGrants = (
    pk: string,
    grants: ApiApplicationGrant[]
  ): Promise<GrantListResponse> =>
    this.request<GrantListResponse>(
      "put",
      {},
      { grants },
      `${this.baseApi}/${pk}/grants`
    );

  /** 资源授权目录（模型 → 动作 / 字段，按本人可授权面收口） */
  grantOptions = (): Promise<GrantCatalogResponse> =>
    this.request<GrantCatalogResponse>(
      "get",
      {},
      {},
      `${this.baseApi}/grant-options`
    );

  /** 应用用量报表（近 N 天，默认 7 / 上限 30） */
  stats = (pk: string, days = 7): Promise<UsageStatsResponse> =>
    this.request<UsageStatsResponse>(
      "get",
      { days },
      {},
      `${this.baseApi}/${pk}/stats`
    );

  /** 应用可授权的接口范围（按当前用户权限收口，供表单「接口范围」勾选） */
  scopeOptions = (): Promise<ScopeCatalogResponse> =>
    this.request<ScopeCatalogResponse>(
      "get",
      {},
      {},
      `${this.baseApi}/scope-options`
    );

  /** 重置应用密钥（旧密钥与旧凭证即时失效），明文仅本次返回 */
  regenerateSecret = (pk: string) =>
    this.request<ApiApplicationCredentialResult>(
      "post",
      {},
      {},
      `${this.baseApi}/${pk}/regenerate-secret`
    );

  /** 回调测试：向登记地址逐一投递 HMAC 签名探测 */
  testCallback = (pk: string) =>
    this.request<CallbackProbeEnvelope>(
      "post",
      {},
      {},
      `${this.baseApi}/${pk}/test-callback`
    );
}

export const apiApplicationApi = new ApiApplicationApi(
  "/api/system/api-applications"
);

/* ---------------- OAuth 授权码（同意页） ---------------- */

export interface OAuthAuthorizeInfo {
  application: { client_id: string; name: string };
  scopes: string[];
  user: { pk: number; username: string };
  redirect_uri: string;
  state: string;
  code_challenge_required: boolean;
  code_challenge_method: string;
}

export interface OAuthAuthorizeResponse {
  code: number;
  detail?: string;
  data: OAuthAuthorizeInfo;
}

export interface OAuthApproveResponse {
  code: number;
  detail?: string;
  data: {
    code: string;
    redirect_uri: string;
    state: string;
    error?: string;
  };
}

class OAuthAuthorizeApi extends BaseApi {
  /** 同意页数据（校验 client/redirect_uri/scope/PKCE，需登录态） */
  authorize = (
    params: Record<string, string>
  ): Promise<OAuthAuthorizeResponse> =>
    this.request<OAuthAuthorizeResponse>(
      "get",
      params,
      {},
      "/api/system/open/oauth/authorize"
    );

  /** 用户同意 / 拒绝（同意返回一次性授权码，拒绝回传 access_denied） */
  approve = (payload: Record<string, unknown>): Promise<OAuthApproveResponse> =>
    this.request<OAuthApproveResponse>(
      "post",
      {},
      payload,
      "/api/system/open/oauth/approve"
    );
}

export const oauthAuthorizeApi = new OAuthAuthorizeApi(
  "/api/system/open/oauth"
);

/** 应用接口范围目录（同页只拉一次：列表 tooltip 与表单勾选器共用，见 utils/scopeDisplay） */
export function loadScopeCatalog(): Promise<ScopeCatalogResponse> {
  return fetchScopeCatalog(SCOPE_CATALOG_KEYS.application, () =>
    apiApplicationApi.scopeOptions()
  );
}

let grantCatalogPromise: Promise<GrantCatalogResponse> | null = null;

/** 资源授权目录（同页只拉一次；失败重置以便重试） */
export function loadGrantCatalog(): Promise<GrantCatalogResponse> {
  if (!grantCatalogPromise) {
    grantCatalogPromise = apiApplicationApi.grantOptions().catch(error => {
      grantCatalogPromise = null;
      throw error;
    });
  }
  return grantCatalogPromise;
}

/** 列表响应取行（兼容分页 results 与裸数组两种返回） */
export function listApplicationRows(res: unknown): ApiApplicationItem[] {
  const payload = (res as { data?: unknown })?.data;
  if (Array.isArray(payload)) return payload as ApiApplicationItem[];
  const results = (payload as { results?: unknown } | undefined)?.results;
  return (Array.isArray(results) ? results : []) as ApiApplicationItem[];
}

/** 逗号分隔文本 ↔ 清单（管理表单口径） */
export function parseListText(text: string): string[] {
  return String(text || "")
    .split(/[,，\n]/)
    .map(item => item.trim())
    .filter(Boolean);
}
