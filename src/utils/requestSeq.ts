/**
 * 请求序号守卫：同页连续发起请求时**仅接受最新一次**的响应。
 *
 * 防的是网络乱序：前一次请求的响应后到（慢网 / 代理缓存 / 服务端不均匀耗时）时，
 * 旧结果不得覆盖新结果、不得提前收口 loading。防抖只能降低并发窗口，不消除乱序，
 * 故消费方（命令面板全局搜索等）需本守卫兜底；列表页主框架的写法同源（见
 * components/RePlusPage/src/utils/plusPageRequest.ts 的 latestRequestSeq）。
 *
 * 典型用法：
 * ```ts
 * const seq = createRequestSeqGuard();
 * async function load(kw: string) {
 *   const ticket = seq.start();
 *   const res = await api(kw);
 *   if (!seq.isLatest(ticket)) return; // 过期响应：更新的请求已发起
 *   // …写结果、收口 loading
 * }
 * ```
 */
export function createRequestSeqGuard() {
  let latest = 0;
  return {
    /** 登记一次新请求：使之前所有在途响应过期，返回本次序号 */
    start(): number {
      latest += 1;
      return latest;
    },
    /** 该序号是否仍为最新一次（期间没有更新的请求发起） */
    isLatest(ticket: number): boolean {
      return ticket === latest;
    }
  };
}

/**
 * 按键隔离的请求序号守卫：同一页面存在多个可并发搜索的槽位（如多字段选人
 * 候选缓存 `Record<fieldKey, options[]>`）时使用——不同键互不失效（A 字段
 * 发起新请求不应作废 B 字段的在途响应），同键内仅最新一次可写。
 *
 * 典型用法：
 * ```ts
 * const guard = createKeyedRequestSeqGuard<string>();
 * async function load(key: string, kw: string) {
 *   const ticket = guard.start(key);
 *   const res = await api(kw);
 *   if (!guard.isLatest(key, ticket)) return; // 该键已有更新的请求
 *   cache[key] = res;
 * }
 * ```
 */
export function createKeyedRequestSeqGuard<K extends string>() {
  const guards = new Map<K, ReturnType<typeof createRequestSeqGuard>>();
  const guardOf = (key: K) => {
    let guard = guards.get(key);
    if (!guard) {
      guard = createRequestSeqGuard();
      guards.set(key, guard);
    }
    return guard;
  };
  return {
    /** 登记某键的一次新请求：仅使该键之前在途响应过期 */
    start(key: K): number {
      return guardOf(key).start();
    },
    /** 该键的该序号是否仍为最新一次 */
    isLatest(key: K, ticket: number): boolean {
      return guardOf(key).isLatest(ticket);
    }
  };
}
