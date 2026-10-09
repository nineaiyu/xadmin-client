import type { PasskeyChallenge } from "@/api/system/security";

/** 断言响应载荷（作为 `code` 字段的 JSON 串提交给后端验签） */
export interface PasskeyAssertionPayload {
  credential_id: string;
  client_data_json: string;
  authenticator_data: string;
  signature: string;
}

/** 挑战端点返回：断言链路（登录 MFA / 二次验证）需要 challenge + rp_id */
export interface AssertChallenge {
  code: number;
  detail?: string;
  data: { challenge: string; rp_id: string };
}

/** 注册挑战端点返回：需要 rp / user / 挑战全集 */
export interface RegisterChallenge {
  code: number;
  detail?: string;
  data: PasskeyChallenge;
}
