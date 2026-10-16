import { describe, expect, it, vi } from "vitest";

import { prefetchRoutesTo, resolveViewLoader } from "../routePrefetch";

/** 收集「计划预取」与「实际加载」的调用 */
function setup(
  paths: string[],
  options: Parameters<typeof prefetchRoutesTo>[1] = {}
) {
  const loads: string[] = [];
  let task: (() => void) | null = null;
  const planned = prefetchRoutesTo(paths, {
    resolve: path => {
      loads.push(path);
      return () => {
        loads.push(`run:${path}`);
        return Promise.resolve();
      };
    },
    schedule: fn => {
      task = fn;
    },
    ...options
  });
  return {
    planned,
    get loads() {
      return loads;
    },
    flush: () => task?.()
  };
}

describe("routePrefetch 路由级预取", () => {
  it("默认上限 4：超过的路径只登记前 4 个", () => {
    const { planned } = setup(["/a", "/b", "/c", "/d", "/e"]);
    expect(planned).toEqual(["/a", "/b", "/c", "/d"]);
  });

  it("跳过当前页（重复加载无收益）", () => {
    const { planned } = setup(["/a", "/b", "/c"], { current: "/a" });
    expect(planned).toEqual(["/b", "/c"]);
  });

  it("无法解析的路径不占用配额", () => {
    const loads: string[] = [];
    const planned = prefetchRoutesTo(["/miss", "/a", "/b"], {
      limit: 2,
      resolve: path => {
        loads.push(path);
        return path === "/miss" ? null : () => Promise.resolve();
      },
      schedule: () => undefined
    });
    expect(planned).toEqual(["/a", "/b"]);
  });

  it("计划与实际加载都在空闲回调触发后发生", () => {
    const { loads, flush } = setup(["/a", "/b"]);
    expect(loads).toEqual(["/a", "/b"]);
    expect(loads.some(item => item.startsWith("run:"))).toBe(false);
    flush();
    expect(loads.filter(item => item.startsWith("run:"))).toEqual([
      "run:/a",
      "run:/b"
    ]);
  });

  it("加载失败静默（不冒泡，不影响导航）", () => {
    const planned = prefetchRoutesTo(["/boom"], {
      resolve: () => () => Promise.reject(new Error("chunk load failed")),
      schedule: fn => fn()
    });
    expect(planned).toEqual(["/boom"]);
  });

  it("resolveViewLoader 对空路径返回 null", () => {
    expect(resolveViewLoader("")).toBeNull();
  });

  it("resolveViewLoader 能解析真实的视图路径（精确优先）", () => {
    const loader = resolveViewLoader("/system/user/index");
    expect(typeof loader).toBe("function");
  });

  it("limit=0 时不做任何预取", () => {
    const { planned, loads } = setup(["/a", "/b"], { limit: 0 });
    expect(planned).toEqual([]);
    expect(loads).toEqual([]);
  });

  it("默认调度可用（jsdom 无 requestIdleCallback 时走 setTimeout 兜底）", () => {
    vi.useFakeTimers();
    const loads: string[] = [];
    prefetchRoutesTo(["/a"], {
      resolve: () => () => {
        loads.push("run:/a");
        return Promise.resolve();
      }
    });
    expect(loads).toEqual([]);
    vi.runAllTimers();
    expect(loads).toEqual(["run:/a"]);
    vi.useRealTimers();
  });
});
