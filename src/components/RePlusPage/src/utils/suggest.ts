/**
 * 远程联想 fetcher 注册表。
 *
 * `SuggestSelect` 是框架层组件，不直接依赖 `@/utils/http`（保持 RePlusPage
 * 无 http 硬依赖的边界，同 `apiSearch` 组件注册表模式）；由业务侧在应用启动时
 * 注册统一 fetcher（走 axios 拦截器：token / 业务码归一），框架只按 url + params 取数。
 *
 * 用法（业务启动文件，如 `@/views/system/apiSearch.ts`）：
 * ```ts
 * registerSuggestFetcher((url, params) => http.request("get", url, { params }));
 * ```
 */
export interface SuggestFetcherResult {
  code?: number;
  detail?: string;
  data?: unknown;
}

export type SuggestFetcher = (
  url: string,
  params: Record<string, unknown>
) => Promise<SuggestFetcherResult>;

let suggestFetcher: SuggestFetcher | undefined;

/** 注册全局 suggestions fetcher（须在首屏渲染前完成） */
export function registerSuggestFetcher(fetcher: SuggestFetcher) {
  suggestFetcher = fetcher;
}

/** 读取已注册的 fetcher；未注册时开发环境告警（联想字段静默无候选难以定位） */
export function getSuggestFetcher(): SuggestFetcher | undefined {
  if (!suggestFetcher && import.meta.env.DEV) {
    console.warn(
      "[RePlusPage] 未注册 suggestions fetcher，请在应用启动时调用 " +
        "registerSuggestFetcher(...)，否则 suggest_url 字段无候选数据"
    );
  }
  return suggestFetcher;
}
