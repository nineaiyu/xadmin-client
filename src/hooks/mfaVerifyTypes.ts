import type { ComputedRef, Ref } from "vue";
import type { MfaMethod } from "@/api/mfa";

/** 发码响应最小契约（登录 MFA 与确认端点返回结构同形） */
export interface MfaSendCodeResult {
  code: number;
  detail: string;
}

/** 验证响应最小契约（成功时 data 为两侧各自载荷：TokenInfo / expire_at） */
export interface MfaVerifyResult {
  code: number;
  detail: string;
  data?: unknown;
}

/** Passkey 断言挑战响应（与 useWebAuthn 的断言链路同契约） */
export interface MfaPasskeyChallengeResult {
  code: number;
  detail: string;
  data: { challenge: string; rp_id: string };
}

/** MFA 验证交互依赖（登录二次验证与敏感操作确认两处共用） */
export interface MfaVerifyOptions<
  TSend extends MfaSendCodeResult,
  TVerify extends MfaVerifyResult
> {
  /** 待选验证方式（登录侧来自密码登录载荷；确认侧来自 confirm-info 拉取） */
  methods: Ref<MfaMethod[]> | ComputedRef<MfaMethod[]>;
  /** 发送挑战码（短信/邮件类方式的前置步骤） */
  sendCode: (method: string) => Promise<TSend>;
  /** 提交验证（Passkey 断言 JSON 亦经 code 字段提交） */
  verify: (method: string, code: string) => Promise<TVerify>;
  /** Passkey 断言挑战（登录以 mfa_token 换取；确认走 authenticate 场景） */
  passkeyChallenge: () => Promise<MfaPasskeyChallengeResult>;
  /** 验证通过后的页面级收尾 */
  onSuccess: (res: TVerify) => void;
}
