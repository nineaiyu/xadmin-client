/**
 * 路由快照版本校验调度器（CachingAsyncRoutes 快照自愈链路）。
 *
 * 从 async-routes 抽出的纯调度逻辑，依赖全部注入（便于单测时避免装配真实
 * 路由与定时器）：
 * - 版本指纹不一致（后台菜单/授权已变更）→ 丢弃快照 + 整页刷新，重走
 *   「无快照 → 全量拉取」链路；
 * - 校验请求失败按退避重试；**重试耗尽同样丢弃快照并刷新**——收权可能
 *   已经发生，继续沿用旧快照会让已收权限整会话可用，fail-closed 优先于
 *   快照的零等待体验。
 *
 * 刷新后若全量拉取失败，兜底由调用方承接（登录/注册态跳 /error/500，
 * 静态路由可重试），不会白屏卡死。
 */

/** 校验失败的重试节奏：30s 退避、最多 2 次（校验请求偶发失败不再整会话放弃） */
export const ROUTES_VERSION_RETRY_DELAY_MS = 30_000;
export const ROUTES_VERSION_MAX_RETRIES = 2;

export interface RoutesVersionReconcilerOptions {
  /** 拉取当前后台版本指纹（GET /api/system/routes 响应内的内容指纹） */
  fetchVersion: () => Promise<string | undefined>;
  /** 丢弃本地快照（async-routes / async-auths / async-routes-version） */
  clearSnapshot: () => void;
  /** 整页刷新：下次启动走「无快照 → 全量拉取」链路 */
  reload: () => void;
  /** 退避计时器（缺省 window.setTimeout；单测注入同步触发） */
  schedule?: (fn: () => void, delayMs: number) => void;
  delayMs?: number;
  maxRetries?: number;
}

/** 单轮快照版本校验：不一致或校验失败重试耗尽 → 丢弃快照并强制重新拉取 */
export function reconcileRoutesVersionOnce(
  cachedVersion: string | undefined,
  {
    fetchVersion,
    clearSnapshot,
    reload,
    schedule = (fn, delayMs) => window.setTimeout(fn, delayMs),
    delayMs = ROUTES_VERSION_RETRY_DELAY_MS,
    maxRetries = ROUTES_VERSION_MAX_RETRIES
  }: RoutesVersionReconcilerOptions
): void {
  const discardSnapshot = () => {
    clearSnapshot();
    reload();
  };

  const attempt = (retriesLeft: number) => {
    fetchVersion()
      .then(version => {
        if (version && version !== cachedVersion) discardSnapshot();
      })
      .catch(() => {
        if (retriesLeft > 0) {
          schedule(() => attempt(retriesLeft - 1), delayMs);
          return;
        }
        // 重试耗尽：不再沿用旧快照（收权可能已发生），丢弃并强制重新拉取
        console.warn(
          "[xadmin] 路由快照版本校验重试耗尽，丢弃本地快照并强制重新拉取。"
        );
        discardSnapshot();
      });
  };

  attempt(maxRetries);
}
