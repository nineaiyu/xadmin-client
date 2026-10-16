import { afterEach, describe, expect, it, vi } from "vitest";

import { VIEWED_ROW_CLASS, useViewedRow } from "./useViewedRow";

/** 自定义适配器桩：外部持有原始串，模拟 IndexedDB 等外部存储 */
function makeCustomAdapter() {
  let raw: string | null = null;
  return {
    adapter: {
      read: () => raw,
      write: (value: string) => {
        raw = value;
      }
    },
    snapshot: () => raw,
    seed: (value: string) => {
      raw = value;
    }
  };
}

describe("useViewedRow（表格已读行）", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("标记与去重：同键重复标记只保留一条", () => {
    const v = useViewedRow({ scope: "t-dedupe", storage: "memory" });
    v.markAsViewed(1);
    v.markAsViewed(1);
    v.markAsViewed("1");
    expect(v.getViewedKeys()).toEqual(["1"]);
    expect(v.isViewed(1)).toBe(true);
    expect(v.isViewed("1")).toBe(true);
  });

  it("批量标记：markKeysAsViewed 一次写入多个键", () => {
    const v = useViewedRow({ scope: "t-batch", storage: "memory" });
    v.markKeysAsViewed([1, 2, 3]);
    expect(v.getViewedKeys()).toEqual(["1", "2", "3"]);
    expect(v.isViewed(2)).toBe(true);
    expect(v.isViewed(4)).toBe(false);
  });

  it("removeKeys：按键移除且立即落盘", () => {
    const { adapter, snapshot } = makeCustomAdapter();
    const v = useViewedRow({ scope: "t-remove", storage: adapter });
    v.markKeysAsViewed([1, 2, 3]);
    v.removeKeys([2]);
    expect(v.getViewedKeys()).toEqual(["1", "3"]);
    expect(JSON.parse(snapshot() as string).keys).toEqual(["1", "3"]);
  });

  it("clearViewed：清空集合并立即落盘", () => {
    const { adapter, snapshot } = makeCustomAdapter();
    const v = useViewedRow({ scope: "t-clear", storage: adapter });
    v.markKeysAsViewed([1, 2]);
    v.clearViewed();
    expect(v.getViewedKeys()).toEqual([]);
    expect(JSON.parse(snapshot() as string).keys).toEqual([]);
  });

  it("TTL 过期：超时记录初始化即清空", () => {
    const { adapter } = makeCustomAdapter();
    adapter.write(
      JSON.stringify({ keys: ["1"], savedAt: Date.now() - 10_000 })
    );
    const v = useViewedRow({ scope: "t-ttl", storage: adapter, ttl: 1000 });
    expect(v.getViewedKeys()).toEqual([]);
  });

  it("TTL 未过期：记录正常读入", () => {
    const { adapter } = makeCustomAdapter();
    adapter.write(JSON.stringify({ keys: ["1", "2"], savedAt: Date.now() }));
    const v = useViewedRow({ scope: "t-ttl2", storage: adapter, ttl: 1000 });
    expect(v.getViewedKeys()).toEqual(["1", "2"]);
  });

  it("maxSize FIFO：超出上限淘汰最旧（尾部最新）", () => {
    const v = useViewedRow({
      scope: "t-fifo",
      storage: "memory",
      maxSize: 3
    });
    v.markKeysAsViewed([1, 2, 3, 4, 5]);
    expect(v.getViewedKeys()).toEqual(["3", "4", "5"]);
  });

  it("防抖持久化：窗口内合并写入，计时结束落盘一次", () => {
    vi.useFakeTimers();
    const { adapter, seed } = makeCustomAdapter();
    void seed;
    const writes: string[] = [];
    const spyAdapter = {
      read: () => adapter.read(),
      write: (raw: string) => {
        writes.push(raw);
        adapter.write(raw);
      }
    };
    const v = useViewedRow({
      scope: "t-debounce",
      storage: spyAdapter,
      debounce: 300
    });
    v.markAsViewed(1);
    v.markAsViewed(2);
    v.markAsViewed(3);
    expect(writes).toHaveLength(0);
    vi.advanceTimersByTime(300);
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0]).keys).toEqual(["1", "2", "3"]);
  });

  it("debounce=0：标记立即落盘", () => {
    const { adapter, snapshot } = makeCustomAdapter();
    const v = useViewedRow({ scope: "t-now", storage: adapter, debounce: 0 });
    v.markAsViewed(9);
    expect(JSON.parse(snapshot() as string).keys).toEqual(["9"]);
  });

  it("跨实例共享存储：二次初始化读回已读集合（刷新保持语义）", () => {
    const { adapter } = makeCustomAdapter();
    const first = useViewedRow({
      scope: "t-share",
      storage: adapter,
      debounce: 0
    });
    first.markAsViewed("a");
    const second = useViewedRow({ scope: "t-share", storage: adapter });
    expect(second.isViewed("a")).toBe(true);
  });

  it("脏数据：非法 JSON 不抛错，按空集合处理", () => {
    const { adapter } = makeCustomAdapter();
    adapter.write("{not-json");
    let v!: ReturnType<typeof useViewedRow>;
    expect(() => {
      v = useViewedRow({ scope: "t-dirty", storage: adapter });
    }).not.toThrow();
    expect(v.getViewedKeys()).toEqual([]);
  });

  it("getRowClassName：已读行返回 is-viewed，未读与键缺失返回空串", () => {
    const v = useViewedRow({ scope: "t-class", storage: "memory" });
    v.markAsViewed(7);
    expect(v.getRowClassName({ row: { pk: 7 } })).toBe(VIEWED_ROW_CLASS);
    expect(v.getRowClassName({ row: { pk: 8 } })).toBe("");
    expect(v.getRowClassName({ row: {} })).toBe("");
  });

  it("自定义 keyField：按配置字段取行键", () => {
    const v = useViewedRow({
      scope: "t-key",
      storage: "memory",
      keyField: "id"
    });
    v.markAsViewed("row-1");
    expect(v.getRowClassName({ row: { id: "row-1" } })).toBe(VIEWED_ROW_CLASS);
    expect(v.getRowClassName({ row: { pk: "row-1" } })).toBe("");
  });

  it("scope 隔离：不同作用域互不影响（local 后端）", () => {
    const a = useViewedRow({
      scope: "t-scope-a",
      storage: "local",
      debounce: 0
    });
    const b = useViewedRow({
      scope: "t-scope-b",
      storage: "local",
      debounce: 0
    });
    a.markAsViewed(1);
    expect(a.isViewed(1)).toBe(true);
    expect(b.isViewed(1)).toBe(false);
    a.clearViewed();
    b.clearViewed();
  });

  it("session 后端：写入跨实例读回", () => {
    const first = useViewedRow({
      scope: "t-session",
      storage: "session",
      debounce: 0
    });
    first.markAsViewed("x");
    const second = useViewedRow({ scope: "t-session", storage: "session" });
    expect(second.isViewed("x")).toBe(true);
    first.clearViewed();
  });
});
