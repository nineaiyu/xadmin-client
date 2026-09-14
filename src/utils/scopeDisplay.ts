import { SUCCESS_CODE } from "@/api/types";
import { createTtlCache } from "./ttlCache";

/**
 * 接口范围（scope）目录缓存与展示工具。
 *
 * 背景：scope 条目本体是判定用的锚定正则（如 `GET ^/api/system/user/[^/]+/?$`），
 * 直接展示给用户不可读；`scope-options` 下发的目录把它还原成人可读的
 * 「METHOD /api/system/user/{pk}」。目录同时是勾选器的选项来源——令牌页与
 * API 应用页各有一套端点，但数据结构一致，故展示/索引逻辑收敛在本模块。
 *
 * 缓存口径：同一页面内「列表 tooltip」与「表单勾选器」消费同一份目录，
 * 按 key 走 TTL + 并发去重（`utils/ttlCache`），避免重复请求。
 */

/** 目录缓存键：令牌与 API 应用端点不同，各自独立缓存避免串用 */
export const SCOPE_CATALOG_KEYS = {
  /** 个人访问令牌：/api/system/personal-access-tokens/scope-options */
  pat: "pat",
  /** API 应用：/api/system/api-applications/scope-options */
  application: "application"
} as const;

/** 目录条目（后端 `system/utils/pat_scope.py::scope_options_for_user` 契约） */
export interface ScopeOption {
  /** scope 条目本体（锚定正则，勾选即写入该值） */
  value: string;
  method: string;
  /** 人可读路径（路由占位符为 {pk} 形态） */
  path: string;
  label: string;
  /** 权限码 */
  code: string;
}

export interface ScopeGroup {
  key: string;
  /** 父菜单标题（可能是 i18n key，展示侧按 te() 判定） */
  title: string;
  options: ScopeOption[];
}

export interface ScopeCatalog {
  total?: number;
  groups?: ScopeGroup[];
}

/** scope-options 响应壳（与 ApiResponse 的 code/detail/data 一致） */
export interface ScopeCatalogResponse {
  code: number;
  detail?: string;
  data?: ScopeCatalog | null;
}

const catalogCache = createTtlCache<ScopeCatalogResponse>({
  ttl: 60 * 1000,
  // 业务失败不写缓存：调用方可重试，避免一次抖动把空目录缓存一整页
  shouldCache: res => res?.code === SUCCESS_CODE
});

/** 取接口范围目录（命中缓存则不发请求；同键并发只发一次） */
export function fetchScopeCatalog(
  key: string,
  fetcher: () => Promise<ScopeCatalogResponse>
): Promise<ScopeCatalogResponse> {
  return catalogCache.get(key, fetcher);
}

/** 清空目录缓存（传 key 只清该键）；菜单/权限变更后需要重新拉取时调用 */
export function invalidateScopeCatalog(key?: string) {
  catalogCache.invalidate(key);
}

/** 建索引：scope 条目值 → 目录条目（供展示还原；未命中即「自定义条目」） */
export function buildScopeIndex(
  groups?: ScopeGroup[]
): Map<string, ScopeOption> {
  const index = new Map<string, ScopeOption>();
  (groups ?? []).forEach(group => {
    (group.options ?? []).forEach(option => {
      if (option?.value && !index.has(option.value))
        index.set(option.value, option);
    });
  });
  return index;
}

/** 单条展示：命中目录显示 `GET /api/system/user/{pk}`，未命中回退条目原文 */
export function formatScopeEntry(
  value: string,
  index?: Map<string, ScopeOption>
): string {
  const option = index?.get(value);
  return option ? `${option.method} ${option.path}` : value;
}

/** 多行展示（列表 tooltip 用）：一行一条，未命中目录的条目原样保留 */
export function formatScopeLines(
  values?: string[],
  index?: Map<string, ScopeOption>
): string {
  return (values ?? []).map(value => formatScopeEntry(value, index)).join("\n");
}
