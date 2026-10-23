import { isSuccess } from "@/api/types";
import { getRefreshToken, setToken } from "@/utils/auth";
import type { TokenInfo } from "@/api/auth";

export type RefreshOutcome =
  | { ok: true; data: TokenInfo }
  | { ok: false; detail: string; error?: unknown };

/**
 * 无感刷新单飞原语：axios 拦截器与 WebSocket 重连共用同一在途 Promise，
 * 避免并发 401 / 重连同时打刷新接口。成功时统一写回 token，失败不清理
 * 凭证（清 token / 跳登录由调用方按各自语义处理）。
 *
 * `refreshTokenApi` 动态引入：api/auth → utils/http 是既有依赖方向，
 * 静态引入会让 http 层与 api 层成环（模块环门禁会拦）。
 */
let inflight: Promise<RefreshOutcome> | null = null;

export function refreshAccessToken(): Promise<RefreshOutcome> {
  if (inflight) return inflight;
  const refresh = getRefreshToken();
  if (!refresh) return Promise.resolve({ ok: false, detail: "" });

  const pending: Promise<RefreshOutcome> =
    (async (): Promise<RefreshOutcome> => {
      const { refreshTokenApi } = await import("@/api/auth");
      const res = await refreshTokenApi({ refresh });
      if (!isSuccess(res)) {
        return { ok: false, detail: res.detail ?? "" };
      }
      setToken(res.data);
      return { ok: true, data: res.data };
    })()
      .catch(error => ({
        ok: false as const,
        detail: String(error?.message ?? error),
        error
      }))
      .finally(() => {
        inflight = null;
      });
  inflight = pending;
  return pending;
}
