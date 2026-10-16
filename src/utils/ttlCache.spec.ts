import { describe, expect, it, vi } from "vitest";
import { createTtlCache } from "./ttlCache";

describe("createTtlCache", () => {
  it("同键第二次调用命中缓存，不重复请求", async () => {
    const fetcher = vi.fn(() => Promise.resolve("v"));
    const cache = createTtlCache<string>();
    await cache.get("k", fetcher);
    await cache.get("k", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("shouldCache 为 false 的结果不写缓存，下次调用重试", async () => {
    const fetcher = vi.fn(() => Promise.resolve("bad"));
    const cache = createTtlCache<string>({ shouldCache: v => v === "ok" });
    expect(await cache.get("k", fetcher)).toBe("bad");
    expect(await cache.get("k", fetcher)).toBe("bad");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("force 绕过缓存强制拉取；invalidate 后重新拉取", async () => {
    const fetcher = vi.fn(() => Promise.resolve("v"));
    const cache = createTtlCache<string>();
    await cache.get("k", fetcher);
    await cache.get("k", fetcher, { force: true });
    cache.invalidate("k");
    await cache.get("k", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("clone 覆盖所有出口，调用方就地修改不污染缓存", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ list: [1] }));
    const cache = createTtlCache<{ list: number[] }>({
      clone: value => structuredClone(value)
    });
    const first = await cache.get("k", fetcher);
    first.list.push(2);
    const second = await cache.get("k", fetcher);
    expect(second.list).toEqual([1]);
  });

  it("失败不缓存且 rejection 传播给调用方，下次调用重试", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce("ok");
    const cache = createTtlCache<string>();
    await expect(cache.get("k", fetcher)).rejects.toThrow("network");
    expect(await cache.get("k", fetcher)).toBe("ok");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("TTL 过期后重新拉取，且可按次覆盖 TTL", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      const fetcher = vi.fn(() => Promise.resolve("v"));
      const cache = createTtlCache<string>({ ttl: 1000 });
      await cache.get("k", fetcher);
      vi.setSystemTime(1001);
      await cache.get("k", fetcher);
      expect(fetcher).toHaveBeenCalledTimes(2);
      // 强刷时按次覆盖为 5s：3s 时仍在存活期内，不再发请求
      await cache.get("k", fetcher, { force: true, ttl: 5000 });
      expect(fetcher).toHaveBeenCalledTimes(3);
      vi.setSystemTime(3000);
      await cache.get("k", fetcher);
      expect(fetcher).toHaveBeenCalledTimes(3);
      vi.setSystemTime(6002);
      await cache.get("k", fetcher);
      expect(fetcher).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });
});
