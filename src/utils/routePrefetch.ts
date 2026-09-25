/**
 * 路由级预取：在浏览器空闲时段预取「最可能访问」的页面 chunk，缩短二次导航等待。
 *
 * 触发策略（避免与首屏争抢带宽）：
 * - 只在空闲窗口执行（`requestIdleCallback`，不支持的浏览器退回延迟 `setTimeout`）；
 * - 上限默认 4 个页面，跳过当前页（已在内存中，重复请求无收益）；
 * - 全部静默失败——预取是尽力而为，任何异常都不应影响导航本身。
 *
 * 预取对象由调用方给出（布局层用菜单顺序近似「常用度」），本模块只负责
 * 路径 → 加载器的解析与调度，便于单测覆盖。
 */

type Loader = () => Promise<unknown>;

const modules = import.meta.glob("/src/views/**/*.{vue,tsx}");

/** 视图路径 → 懒加载函数（精确优先：`.vue` → `.tsx` → `index.vue` → `index.tsx`） */
export function resolveViewLoader(path: string): Loader | null {
  if (!path) return null;
  const base = `/src/views${path}`.replace(/\/+$/, "");
  const candidates = [
    `${base}.vue`,
    `${base}.tsx`,
    `${base}/index.vue`,
    `${base}/index.tsx`
  ];
  for (const key of candidates) {
    const loader = modules[key] as Loader | undefined;
    if (loader) return loader;
  }
  return null;
}

export interface PrefetchOptions {
  /** 预取上限（默认 4） */
  limit?: number;
  /** 当前页路径（跳过，避免重复加载） */
  current?: string;
  /** 加载器解析（测试注入用） */
  resolve?: (path: string) => Loader | null;
  /** 调度（测试注入用） */
  schedule?: (task: () => void) => void;
}

/** 默认调度：空闲回调优先，兜底 2s 延迟（Safari 等无 requestIdleCallback 的浏览器） */
function defaultSchedule(task: () => void) {
  if (typeof window === "undefined") return;
  const idle = (
    window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number }
      ) => void;
    }
  ).requestIdleCallback;
  if (typeof idle === "function") {
    idle(() => task(), { timeout: 3000 });
  } else {
    window.setTimeout(task, 2000);
  }
}

/**
 * 预取给定路径对应的页面 chunk（同步返回；实际加载在空闲时段发生）。
 * @returns 本次计划预取的路径列表（仅用于测试与日志）
 */
export function prefetchRoutesTo(
  paths: readonly string[],
  options: PrefetchOptions = {}
): string[] {
  const limit = Math.max(options.limit ?? 4, 0);
  const resolve = options.resolve ?? resolveViewLoader;
  const schedule = options.schedule ?? defaultSchedule;
  const planned: string[] = [];
  const seen = new Set<string>(options.current ? [options.current] : []);
  for (const path of paths) {
    if (planned.length >= limit) break;
    if (!path || seen.has(path)) continue;
    if (!resolve(path)) continue;
    seen.add(path);
    planned.push(path);
  }
  schedule(() => {
    for (const path of planned) {
      void resolve(path)?.().catch(() => undefined);
    }
  });
  return planned;
}
