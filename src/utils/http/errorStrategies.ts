import type { AxiosResponseHeaders, RawAxiosResponseHeaders } from "axios";
import { ElMessage } from "element-plus/es/components/message/index.mjs";
import { announce } from "@/utils/announcer";
import { remoteAccessToken, removeToken } from "@/utils/auth";
import {
  approvalKey,
  deletePendingApproval,
  setPendingApproval
} from "./pendingApproval";
import { redirectToLogin, redirectToModuleDisabled } from "./redirect";
import type { PureHttpRequestConfig } from "./types.d";
import { clearRouteSnapshot } from "@/utils/routeSnapshot";

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
  /** `error.response.headers`（429 Retry-After 等协议头读取用；值可能为 string | string[]） */
  headers?: RawAxiosResponseHeaders | AxiosResponseHeaders;
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

/**
 * 403 通用（权限被拒）：清动态路由/权限快照——快照模式的原生缺陷是「会话内被收权
 * 时旧菜单仍可用到下次刷新」，403 是权限面变化的唯一运行时信号；清快照让用户下次
 * 进入应用重拉路由自愈。提示与落定仍交后续策略/默认兜底（本策略只做副作用）。
 */
const forbiddenSnapshotStrategy: SendErrorStrategy = {
  match: ({ status }) => status === 403,
  handle: () => {
    clearRouteSnapshot();
    return false;
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

/** 404 + 业务码 1001：命中已停用功能模块的网关拦截（ModuleGateMiddleware），给专用提示而非裸 404 */
const moduleDisabledStrategy: SendErrorStrategy = {
  match: ({ status, data }) => status === 404 && data?.code === 1001,
  handle: ({ config, data, reject }) => {
    // detail 由后端按请求语言翻译（zh: 功能未启用 / en: Feature not enabled）；module 指明命中的模块 id
    const moduleId = typeof data?.module === "string" ? data.module : "";
    ElMessage.warning(
      `${data?.detail ?? ""}${moduleId ? ` (${moduleId})` : ""}`
    );
    // 页面取数（GET）失败 → 整页化：跳「模块已停用」页（带返回入口），替代停留在必然
    // 空数据的页面上；变更类请求失败只提示，避免打断用户正在进行的操作。
    // 已在该页时不再跳转（页面自身的轮询/刷新会再次命中网关）。
    const method = String(config?.method ?? "").toLowerCase();
    const onDisabledPage = window.location.hash.includes(
      "/error/module-disabled"
    );
    if (method === "get" && !onDisabledPage) {
      redirectToModuleDisabled(moduleId);
    }
    reject(data);
    return true;
  }
};

/** 限流提示的相同 detail 去重窗口（毫秒）：连发请求命中同一限流只弹一次 */
export const RATE_LIMIT_DEDUP_WINDOW_MS = 3000;
/** 429 重发的延迟上限（秒）：Retry-After 可能给很大的值，等待过久不如让用户稍后手动重试 */
const RETRY_DELAY_MAX_SECONDS = 5;
/** 无 Retry-After 头时的默认重发延迟（秒） */
const RETRY_DELAY_DEFAULT_SECONDS = 1;

const lastRateLimitToastAt = new Map<string, number>();

/**
 * 429 提示（带 3 秒相同 detail 去重）：限流常在批量并发/轮询场景连发，
 * 去重避免 ElMessage 队列连续弹窗淹没屏幕。
 */
export function notifyRateLimited(detail: string): void {
  const now = Date.now();
  const elapsed =
    now - (lastRateLimitToastAt.get(detail) ?? Number.NEGATIVE_INFINITY);
  // 仅「窗口内且时间未倒流」去重：系统时钟回拨不应吞掉真实提示
  if (elapsed >= 0 && elapsed < RATE_LIMIT_DEDUP_WINDOW_MS) return;
  lastRateLimitToastAt.set(detail, now);
  ElMessage.error(detail || "Too many requests");
}

/** 解析 Retry-After（仅支持秒数形态；非法/缺失返回默认值，并钳制到上限内） */
export function parseRetryAfterSeconds(value: unknown): number {
  const parsed = Number(value);
  const seconds =
    Number.isFinite(parsed) && parsed >= 0
      ? parsed
      : RETRY_DELAY_DEFAULT_SECONDS;
  return Math.min(seconds, RETRY_DELAY_MAX_SECONDS);
}

/** 429 Too Many Requests：GET 读一次 Retry-After 延迟重发（一次性，`_rateLimitRetried` 防循环）；
 * 其余方法/重发后仍限流 → 带 3 秒去重的提示后落定拒绝 */
const rateLimitStrategy: SendErrorStrategy = {
  match: ({ status }) => status === 429,
  handle: ({ config, data, headers, resend, resolve, reject }) => {
    const detail = String(data?.detail ?? "");
    const method = String(config?.method ?? "").toLowerCase();
    if (method === "get" && !config._rateLimitRetried) {
      config._rateLimitRetried = true;
      const delayMs = parseRetryAfterSeconds(headers?.["retry-after"]) * 1000;
      window.setTimeout(() => resolve(resend()), delayMs);
      return true;
    }
    notifyRateLimited(detail);
    reject(data);
    return true;
  }
};

/**
 * 400 Bad Request：业务拒绝（字段校验失败 / 状态冲突 / PROTECT 引用不可删除（业务码 998）等）。
 *
 * 显式落定：提示 detail 并读屏播报后 reject。此分支不得静默——删除类操作依赖它
 * （后端 998 已从 HTTP 200 改为 400，页面侧 handleOperation 的 failed 回调不再执行，
 * 提示由本策略承担）；编辑表单仍会在 catch 里做 applyServerErrors 内联展示。
 */
const badRequestStrategy: SendErrorStrategy = {
  match: ({ status }) => status === 400,
  handle: ({ data, reject }) => {
    const detail = String(data?.detail ?? "");
    ElMessage.error(detail);
    announce(detail);
    reject(data);
    return true;
  }
};

export const SEND_ERROR_STRATEGIES: SendErrorStrategy[] = [
  badRequestStrategy,
  tokenExpiredStrategy,
  unauthorizedStrategy,
  mfaConfirmStrategy,
  approvalPendingStrategy,
  approvalRejectedStrategy,
  forbiddenSnapshotStrategy,
  moduleDisabledStrategy,
  tooEarlyStrategy,
  rateLimitStrategy
];
