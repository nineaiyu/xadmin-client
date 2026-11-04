import { isSuccess } from "@/api/types";
import Cookies from "js-cookie";
import {
  getRefreshToken,
  isCookieAuthSession,
  multipleTabsKey,
  setToken
} from "@/utils/auth";
import type { TokenInfo } from "@/api/auth";

export type RefreshOutcome =
  | { ok: true; data: TokenInfo }
  | { ok: false; detail: string; error?: unknown };

/**
 * 无感刷新单飞原语：axios 拦截器与 WebSocket 重连共用同一在途 Promise，
 * 避免并发 401 / 重连同时打刷新接口。成功时统一写回 token，失败不清理
 * 凭证（清 token / 跳登录由调用方按各自语义处理）。
 *
 * 凭证**双读**（与服务端刷新端点同口径）：
 * - header 模式：refresh 在 JS Cookie，随请求体提交；
 * - cookie 模式：refresh 在 HttpOnly Cookie（本文件读不到），提交空载荷，
 *   服务端回落 X-Refresh-Token Cookie 轮换后经 Set-Cookie 重下——本地无需
 *   （也无法）写 token，setToken 只落会话标记。
 *
 * `refreshTokenApi` 动态引入：api/auth → utils/http 是既有依赖方向，
 * 静态引入会让 http 层与 api 层成环（模块环门禁会拦）。
 */
let inflight: Promise<RefreshOutcome> | null = null;

/**
 * 从拒绝原因提取可读文案：http 层对 4xx/5xx 以响应体对象收尾（`{code, detail}`），
 * 直接 `String(error)` 只会得到 `[object Object]`。优先取业务 detail，其次
 * `Error.message`；无法识别的形态归一为空串，交由调用方决定是否提示。
 */
function resolveFailureDetail(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const detail = (error as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}

export function refreshAccessToken(): Promise<RefreshOutcome> {
  if (inflight) return inflight;
  const cookieSession = isCookieAuthSession();
  const refresh = getRefreshToken();
  // Cookie 模式没有本地 token 可判：以 multiple-tabs 会话标记为「有会话」判据；
  // header 模式维持既有口径（无可读 refresh 即无可刷新）
  const hasCredential = cookieSession
    ? Boolean(Cookies.get(multipleTabsKey))
    : Boolean(refresh);
  if (!hasCredential) return Promise.resolve({ ok: false, detail: "" });

  const pending: Promise<RefreshOutcome> =
    (async (): Promise<RefreshOutcome> => {
      const { refreshTokenApi } = await import("@/api/auth");
      // Cookie 模式空载荷：服务端按 X-Refresh-Token Cookie 双读 + Origin 兜底
      const res = await refreshTokenApi(cookieSession ? {} : { refresh });
      if (!isSuccess(res)) {
        return { ok: false, detail: res.detail ?? "" };
      }
      setToken(res.data);
      return { ok: true, data: res.data };
    })()
      .catch(error => ({
        ok: false as const,
        detail: resolveFailureDetail(error),
        error
      }))
      .finally(() => {
        inflight = null;
      });
  inflight = pending;
  return pending;
}
