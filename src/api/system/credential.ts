import { BaseApi } from "@/api/base";

/** 凭据条目（只读聚合：不回传任何值，只给状态与可运维动作） */
export interface CredentialEntry {
  name: string;
  scope: "setting" | "system_config" | "model_field";
  /** 可读名（模型字段级为友好名，其余与 name 同） */
  label?: string;
  category?: string;
  /** 需要加密的字段（SystemConfig 值内字段；["*"] = 整值加密） */
  fields?: string[];
  configured?: boolean;
  encrypted?: boolean;
  /** 是否仍为明文（加密状态） */
  plaintext?: boolean;
  /** SystemConfig：empty / encrypted / plaintext */
  status?: string;
  configured_count?: number;
  /** 服务端下发的说明（仅展示，不含任何值） */
  description?: string;
  /** 已配置时的固定掩码占位；空串 = 未配置（不暴露明文/长度） */
  masked?: string;
  /** 是否可原地轮换（仅服务端自生成的密钥为真） */
  rotatable?: boolean;
  /** 外部签发凭据的更换入口（路由路径，空串 = 无） */
  change_entry?: string;
  /** 使用方提示：这把凭据被哪个链路消费（静态知识，服务端下发） */
  used_by?: string;
  /** 最近一次原地轮换时间（审计台账回溯；从未轮换为空串） */
  last_rotated?: string;
  /** 建议轮换：自生成密钥超过阈值未轮换（仅 rotatable 行有意义） */
  rotate_overdue?: boolean;
  updated_time?: string;
}

export type CredentialScope = "setting" | "system_config" | "model_field";

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

  rotate = (data: { key: string; scope?: CredentialScope }) => {
    return this.request<CredentialRotateResult>(
      "post",
      {},
      data,
      `${this.baseApi}/rotate`
    );
  };
}

export const credentialApi = new CredentialApi("/api/system/credentials");
