import { cloneDeep } from "lodash-es";

/**
 * 跨页面共享的「全量元数据列表」缓存。
 *
 * 背景：菜单全量列表（`list({page:1,size:1000})`）在菜单页、角色页、权限页各拉一次，
 * 切页即重复请求同一份数据，返回原页面还会再拉一次。
 *
 * 一致性策略（避免「刚新建的 X 在下拉/树里看不到」）：
 * 1. 任一写操作成功后由 RePlusPage 的 `handleOperation` 调用 `invalidateMetaCache()` 清空；
 * 2. 权威刷新方（菜单页自身的 `getMenuData`）以 `force: true` 强制拉取并回填缓存；
 * 3. TTL 兜底（默认 60s），超时后重新拉取。
 *
 * 读取返回**深拷贝**：调用方（如菜单页）会对结果做就地归一化，共享同一对象会让
 * 页面的修改互相污染。
 */

/** 元数据缓存键（集中声明，避免各页面手写字符串拼错） */
export const META_KEYS = {
  /** 菜单全量列表（菜单页 / 角色页 / 权限页共用） */
  menu: "menu"
} as const;

/** 默认存活时间：超过后重新拉取，作为失效遗漏的兜底 */
const META_TTL = 60 * 1000;

const cache = new Map<string, { response: unknown; expires: number }>();
const inflight = new Map<string, Promise<unknown>>();

interface MetaListResponse {
  code: number;
}

/**
 * 取全量元数据列表（命中缓存则不发请求）。
 *
 * @param key   缓存键（见 `META_KEYS`）
 * @param fetcher 实际请求（仅在未命中时调用）
 * @param options `force` 强制拉取（权威刷新方使用）；`ttl` 覆盖默认存活时间
 */
export function fetchMetaList<R extends MetaListResponse>(
  key: string,
  fetcher: () => Promise<R>,
  options: { ttl?: number; force?: boolean } = {}
): Promise<R> {
  const { ttl = META_TTL, force = false } = options;

  if (!force) {
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return Promise.resolve(cloneDeep(cached.response) as R);
    }
    const pending = inflight.get(key);
    // 并发去重：同键的多个页面同时进入时只发一次请求
    if (pending) return pending.then(res => cloneDeep(res) as R);
  }

  const request = fetcher().then(res => {
    // 业务失败不写缓存：调用方会提示，下次调用可重试
    if (res?.code === 1000) {
      cache.set(key, { response: res, expires: Date.now() + ttl });
    }
    return res;
  });
  inflight.set(key, request);
  request
    .catch(() => undefined)
    .finally(() => {
      if (inflight.get(key) === request) inflight.delete(key);
    });

  return request.then(res => cloneDeep(res) as R);
}

/** 清空元数据缓存（传 key 只清该键）。写操作成功后调用。 */
export function invalidateMetaCache(key?: string) {
  if (key) cache.delete(key);
  else cache.clear();
}
