/**
 * 通用的「TTL + 并发去重」进程内缓存工厂。
 *
 * 背景：`utils/metaCache.ts`（元数据共享缓存）与 `utils/dict.ts`（字典缓存）
 * 各自维护了一份 "Map 缓存 + inflight 去重 + TTL 过期" 的同构实现，为避免
 * 第三份实现继续漂移，收敛为本工厂；两者的语义差异通过 options 表达：
 * - `shouldCache`：判定 fetcher 的成功结果是否写入缓存（如元数据按业务码
 *   `code === 1000`，字典默认全缓存、失败走外层 catch 降级且不缓存）；
 * - `clone`：出口拷贝（元数据返回深拷贝，防调用方就地修改污染缓存；字典无需拷贝）。
 *
 * 失败（fetcher reject）永远不写缓存，inflight 立即清理，下次调用可重试；
 * rejection 照常传播，由调用方决定降级策略。
 */

export interface TtlCacheOptions<R> {
  /** 默认存活时间（ms），`get` 时可按次覆盖 */
  ttl?: number;
  /** 判定 fetcher 的成功结果是否写入缓存，缺省全部写入 */
  shouldCache?: (value: R) => boolean;
  /** 出口拷贝（命中缓存、复用 inflight、本次拉取三条出口统一经过），缺省原样返回 */
  clone?: (value: R) => R;
}

export interface TtlGetOptions {
  /** 强制绕过缓存拉取（权威刷新方使用） */
  force?: boolean;
  /** 覆盖默认 TTL */
  ttl?: number;
}

export interface TtlCache<R> {
  get: (
    key: string,
    fetcher: () => Promise<R>,
    options?: TtlGetOptions
  ) => Promise<R>;
  /** 清空缓存（传 key 只清该键）。写操作成功后调用。 */
  invalidate: (key?: string) => void;
}

export function createTtlCache<R>(
  options: TtlCacheOptions<R> = {}
): TtlCache<R> {
  const { ttl: defaultTtl = 60 * 1000, shouldCache, clone } = options;
  const store = new Map<string, { value: R; expires: number }>();
  const inflight = new Map<string, Promise<R>>();

  const through = (value: R): R => (clone ? clone(value) : value);

  function get(
    key: string,
    fetcher: () => Promise<R>,
    { ttl = defaultTtl, force = false }: TtlGetOptions = {}
  ): Promise<R> {
    if (!force) {
      const cached = store.get(key);
      if (cached && cached.expires > Date.now()) {
        return Promise.resolve(through(cached.value));
      }
      // 并发去重：同键的多个调用方同时进入时只发一次请求
      const pending = inflight.get(key);
      if (pending) return pending.then(through);
    }

    const request = fetcher().then(value => {
      if (!shouldCache || shouldCache(value)) {
        store.set(key, { value, expires: Date.now() + ttl });
      }
      return value;
    });
    inflight.set(key, request);
    // 失败只传播给调用方、不写缓存；这里静默兜底，避免 inflight 链上的 unhandled rejection
    request
      .catch(() => undefined)
      .finally(() => {
        if (inflight.get(key) === request) inflight.delete(key);
      });

    return request.then(through);
  }

  function invalidate(key?: string) {
    if (key) store.delete(key);
    else store.clear();
  }

  return { get, invalidate };
}
