import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchMetaList,
  invalidateMetaCache,
  META_KEYS
} from "@/utils/metaCache";

interface Row {
  pk: number;
  name: string;
}

/** 成功响应：形状与 list 接口一致 */
const ok = (results: Row[]) => ({
  code: 1000,
  data: { results }
});

/** 业务失败响应 */
const fail = (detail = "boom") => ({ code: 1001, detail, data: undefined });

describe("元数据共享缓存", () => {
  beforeEach(() => invalidateMetaCache());

  it("同键第二次调用命中缓存，不重复请求", async () => {
    const fetcher = vi.fn(() => Promise.resolve(ok([{ pk: 1, name: "a" }])));
    const first = await fetchMetaList(META_KEYS.menu, fetcher);
    const second = await fetchMetaList(META_KEYS.menu, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(first.data.results).toEqual(second.data.results);
  });

  it("返回深拷贝：调用方就地修改不会污染缓存", async () => {
    const fetcher = vi.fn(() => Promise.resolve(ok([{ pk: 1, name: "a" }])));
    const first = await fetchMetaList(META_KEYS.menu, fetcher);
    first.data.results[0].name = "changed";

    const second = await fetchMetaList(META_KEYS.menu, fetcher);
    expect(second.data.results[0].name).toBe("a");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("force 忽略缓存强制拉取", async () => {
    const fetcher = vi.fn(() => Promise.resolve(ok([{ pk: 1, name: "a" }])));
    await fetchMetaList(META_KEYS.menu, fetcher);
    await fetchMetaList(META_KEYS.menu, fetcher, { force: true });

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("失效后重新拉取", async () => {
    const fetcher = vi.fn(() => Promise.resolve(ok([{ pk: 1, name: "a" }])));
    await fetchMetaList(META_KEYS.menu, fetcher);
    invalidateMetaCache(META_KEYS.menu);
    await fetchMetaList(META_KEYS.menu, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("业务失败不写缓存，下次调用会重试", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(fail())
      .mockResolvedValueOnce(ok([{ pk: 1, name: "a" }]));

    const first = await fetchMetaList(META_KEYS.menu, fetcher);
    expect(first.code).toBe(1001);

    const second = await fetchMetaList(META_KEYS.menu, fetcher);
    expect(second.code).toBe(1000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("并发调用去重：同键并发只发一次请求", async () => {
    let resolveRequest: (value: ReturnType<typeof ok>) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<ReturnType<typeof ok>>(resolve => {
          resolveRequest = resolve;
        })
    );

    const a = fetchMetaList(META_KEYS.menu, fetcher);
    const b = fetchMetaList(META_KEYS.menu, fetcher);
    resolveRequest(ok([{ pk: 1, name: "a" }]));

    const [ra, rb] = await Promise.all([a, b]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(ra.data.results).toEqual(rb.data.results);
  });
});
