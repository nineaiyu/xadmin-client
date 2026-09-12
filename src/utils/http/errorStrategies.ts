import { ElMessage } from "element-plus";
import { remoteAccessToken, removeToken } from "@/utils/auth";
import {
  approvalKey,
  deletePendingApproval,
  setPendingApproval
} from "./pendingApproval";
import { redirectToLogin } from "./redirect";
import type { PureHttpRequestConfig } from "./types.d";

/**
 * `send()` 统一错误处理的策略表（自 index.ts 的状态码 if-chain 收敛而来）。
 *
 * 按声明顺序匹配，命中且处理完成即落定 Promise（resolve/reject 恰好一次）；
 * 全部未命中走默认兜底（`data?.detail ?? statusText` 提示 + reject）。
 * 各策略的注释保留了原分支的行为语义与契约说明，改动需对照 http spec。
 */

/** 后端业务错误体（ApiResponse 错误形态：code/detail/type 等） */
export interface ApiErrorBody {
  code?: number;
  detail?: string;
  type?: string;
  confirm_type?: string;
  data?: { approval_id?: string; [key: string]: unknown };
  [key: string]: unknown;
}

/** send() 错误处理上下文：仅当 `error.response` 存在时进入策略匹配 */
export interface SendErrorContext {
  config: PureHttpRequestConfig;
  /** 响应状态码 */
  status: number;
  statusText: string;
  /** `error.response.data`（业务错误体） */
  data: ApiErrorBody;
  /** 以统一错误处理重发原请求（412-MFA 验证通过后走此路径） */
  resend: () => Promise<unknown>;
  /** 绕过 send 直接重发原始 axios 请求（40001 静默重试走此路径，与原实现一致） */
  reissue: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

interface SendErrorStrategy {
  match: (ctx: SendErrorContext) => boolean;
  /** 命中并落定 Promise 返回 true；返回 false 交给后续策略/默认兜底 */
  handle: (ctx: SendErrorContext) => boolean;
}

/** 401 + 业务码 40001：access 过期，静默换新 access 后重发一次（`_tokenRetried` 防死循环） */
const tokenExpiredStrategy: SendErrorStrategy = {
  match: ({ status, data }) => status === 401 && data?.code === 40001,
  handle: ({ config, data, reissue, resolve, reject }) => {
    if (config._tokenRetried) {
      // 重试后仍 40001（如刷新失败），跳登录防止死循环
      ElMessage.error(data?.detail);
      removeToken();
      redirectToLogin();
      reject(data);
      return true;
    }
    config._tokenRetried = true;
    remoteAccessToken();
    resolve(reissue());
    return true;
  }
};

/** 401 其他（refresh 失效等）：提示 + 清 token + 跳登录 */
const unauthorizedStrategy: SendErrorStrategy = {
  match: ({ status }) => status === 401,
  handle: ({ data, reject }) => {
    ElMessage.error(data?.detail);
    removeToken();
    // 跳转登录页并携带回跳地址，替代整页 reload（保留路由上下文）
    redirectToLogin();
    reject(data);
    return true;
  }
};

/** 412 + user_confirm_required：敏感操作二次验证（MFA），通过后自动重发原请求 */
const mfaConfirmStrategy: SendErrorStrategy = {
  match: ({ status, data }) =>
    status === 412 && data?.type === "user_confirm_required",
  handle: ({ config, data, resend, resolve, reject }) => {
    if (config._mfaRetried) {
      // 重发后仍未通过（如确认过期），不再递归弹窗
      ElMessage.error(data?.detail);
      reject(data);
      return true;
    }
    config._mfaRetried = true;
    // 动态引入避免与验证组件产生模块循环依赖
    import("@/components/ReMfaConfirm")
      .then(({ confirmMfa }) => confirmMfa(data?.confirm_type))
      .then(() => resolve(resend()))
      .catch(() => {
        reject(data);
      });
    return true;
  }
};

/** 412 + approval_required（业务码 1002）：已建审批单，暂存令牌等审批通过后由拦截器携带重发 */
const approvalPendingStrategy: SendErrorStrategy = {
  match: ({ status, data }) =>
    status === 412 && data?.type === "approval_required",
  handle: ({ config, data, reject }) => {
    const approvalId = data?.data?.approval_id;
    if (approvalId) {
      // 优先用请求期写入的指纹 key（axios 改写 config.data 后仍能命中）；
      // 未经请求拦截器的调用路径（直发 axiosInstance / 单测驱动）回退重算
      const requestKey = config._approvalKey;
      setPendingApproval(
        requestKey ?? approvalKey(config.method, config.url, config.data),
        approvalId
      );
    }
    ElMessage.warning(data?.detail);
    reject(data);
    return true;
  }
};

/** 403 + approval_required：审批令牌被拒（驳回/过期/已消费/指纹不一致），清除暂存令牌 */
const approvalRejectedStrategy: SendErrorStrategy = {
  match: ({ status, data }) =>
    status === 403 && data?.type === "approval_required",
  handle: ({ config, data, reject }) => {
    const rejectedKey = config._approvalKey;
    deletePendingApproval(
      rejectedKey ?? approvalKey(config.method, config.url, config.data)
    );
    ElMessage.error(data?.detail);
    reject(data);
    return true;
  }
};

/** 425 Too Early：资源仍在准备（如 Office 转 PDF 中，业务码 1006），由调用方自行重试，不弹全局错误 */
const tooEarlyStrategy: SendErrorStrategy = {
  match: ({ status }) => status === 425,
  handle: ({ data, reject }) => {
    reject(data);
    return true;
  }
};

export const SEND_ERROR_STRATEGIES: SendErrorStrategy[] = [
  tokenExpiredStrategy,
  unauthorizedStrategy,
  mfaConfirmStrategy,
  approvalPendingStrategy,
  approvalRejectedStrategy,
  tooEarlyStrategy
];
