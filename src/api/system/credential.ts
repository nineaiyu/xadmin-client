import { BaseApi } from "@/api/base";

/** 凭据条目（只读聚合：不回传任何值，只给状态与最近更新时间） */
export interface CredentialEntry {
  name: string;
  scope: "setting" | "system_config" | "model_field";
  /** 模型字段级凭据的可读名 */
  label?: string;
  category?: string;
  /** 需要加密的字段（SystemConfig 值内字段；["*"] = 整值加密） */
  fields?: string[];
  configured?: boolean;
  encrypted?: boolean;
  /** SystemConfig：empty / encrypted / plaintext */
  status?: string;
  configured_count?: number;
  description?: string;
  updated_time?: string;
}

export interface CredentialOverview {
  settings: CredentialEntry[];
  system_configs: CredentialEntry[];
  model_fields: CredentialEntry[];
  /** 仍为明文的敏感 SystemConfig 键（巡检结果） */
  plaintext: string[];
}

export interface CredentialRotateResult {
  code: number;
  detail?: string;
  data?: { action?: string };
}

/** 凭据与密钥：只读聚合 + 轮换（重新加密） */
class CredentialApi extends BaseApi {
  overview = () => {
    return this.request<{ code: number; data: CredentialOverview }>(
      "get",
      {},
      {},
      `${this.baseApi}/overview`
    );
  };

  rotate = (data: { key: string; scope?: string }) => {
    return this.request<CredentialRotateResult>(
      "post",
      {},
      data,
      `${this.baseApi}/rotate`
    );
  };
}

export const credentialApi = new CredentialApi("/api/system/credentials");
