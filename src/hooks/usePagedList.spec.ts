import { describe, expect, it, vi } from "vitest";

import { SUCCESS_CODE } from "@/api/types";
import { usePagedList } from "./usePagedList";
import type { PagedResponse } from "./usePagedList";

const ok = (results: string[], total = results.length): PagedResponse => ({
  code: SUCCESS_CODE,
  data: { results, total }
});

type Fetch = (params: { page: number; size: number }) => Promise<PagedResponse>;

/** 统一构造：默认 pickRows 取 data.results（与多数接口契约一致） */
const makeList = (fetch: Fetch, extra?: { pageSize?: number }) =>
  usePagedList<string>({
    fetch,
    pickRows: res => (res.data as { results?: string[] } | null)?.results ?? [],
    ...extra
  });

describe("usePagedList（远程分页列表原语）", () => {
  it("加载成功：填充行与总数并复位 loading", async () => {
    const fetch = vi.fn(async () => ok(["a", "b"], 12));
    const list = makeList(fetch);
    const done = list.load();
    expect(list.loading.value).toBe(true);
    expect(await done).toBe(true);
    expect(list.loading.value).toBe(false);
    expect(list.rows.value).toEqual(["a", "b"]);
    expect(list.total.value).toBe(12);
    expect(fetch).toHaveBeenCalledWith({ page: 1, size: 10 });
  });

  it("业务失败（code 非成功）：返回 false 且保持现状", async () => {
    const fetch = vi.fn(async () => ({
      code: 1001,
      data: null,
      detail: "无权限"
    }));
    const list = makeList(fetch);
    expect(await list.load()).toBe(false);
    expect(list.rows.value).toEqual([]);
    expect(list.total.value).toBe(0);
    expect(list.loading.value).toBe(false);
  });

  it("失败回调 onFail：归一后统一回调", async () => {
    const onFail = vi.fn();
    const fetch = vi.fn(async () => ({ code: 1001, data: null, detail: "x" }));
    const list = usePagedList<string>({
      fetch,
      pickRows: () => [],
      onFail
    });
    await list.load();
    expect(onFail).toHaveBeenCalledWith(
      expect.objectContaining({ code: 1001 })
    );
  });

  it("网络异常归一：返回 false 且复位 loading", async () => {
    const fetch = vi.fn(async () => {
      throw { detail: "网络异常" };
    });
    const list = makeList(fetch);
    expect(await list.load()).toBe(false);
    expect(list.loading.value).toBe(false);
  });

  it("resetPage：回到第一页再请求", async () => {
    const fetch = vi.fn(async ({ page }: { page: number }) => ok([`p${page}`]));
    const list = makeList(fetch);
    list.page.value = 3;
    await list.load();
    expect(fetch).toHaveBeenLastCalledWith({ page: 3, size: 10 });
    await list.load(true);
    expect(list.page.value).toBe(1);
    expect(fetch).toHaveBeenLastCalledWith({ page: 1, size: 10 });
  });

  it("setPage / setSize：写入页码并加载，setSize 回第一页", async () => {
    const fetch = vi.fn(async () => ok([]));
    const list = makeList(fetch);
    await list.setPage(4);
    expect(list.page.value).toBe(4);
    expect(fetch).toHaveBeenLastCalledWith({ page: 4, size: 10 });
    await list.setSize(50);
    expect(list.size.value).toBe(50);
    expect(list.page.value).toBe(1);
    expect(fetch).toHaveBeenLastCalledWith({ page: 1, size: 50 });
  });

  it("竞态守卫：旧请求晚到不覆盖新请求结果", async () => {
    let resolveFirst!: (value: PagedResponse) => void;
    let call = 0;
    const fetch = () => {
      call += 1;
      if (call === 1) {
        return new Promise<PagedResponse>(resolve => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve(ok(["new"], 1));
    };
    const list = makeList(fetch);
    const first = list.load();
    expect(await list.load()).toBe(true);
    expect(list.rows.value).toEqual(["new"]);
    resolveFirst(ok(["stale"], 99));
    expect(await first).toBe(false);
    expect(list.rows.value).toEqual(["new"]);
    expect(list.total.value).toBe(1);
  });

  it("裸数组 data：由 pickRows 显式提取", async () => {
    const fetch = vi.fn(async () => ({ code: SUCCESS_CODE, data: ["x", "y"] }));
    const list = usePagedList<string>({
      fetch,
      pickRows: res => (Array.isArray(res.data) ? res.data : []) as string[],
      pickTotal: res => (Array.isArray(res.data) ? res.data.length : 0)
    });
    await list.load();
    expect(list.rows.value).toEqual(["x", "y"]);
    expect(list.total.value).toBe(2);
  });

  it("自定义 pickRows / pickTotal", async () => {
    const fetch = vi.fn(async () => ({
      code: SUCCESS_CODE,
      data: { list: [{ id: 1 }], count: 7 }
    }));
    const list = usePagedList<{ id: number }>({
      fetch,
      pickRows: res =>
        (res.data as { list?: { id: number }[] } | null)?.list ?? [],
      pickTotal: res => (res.data as { count?: number } | null)?.count ?? 0
    });
    await list.load();
    expect(list.rows.value).toEqual([{ id: 1 }]);
    expect(list.total.value).toBe(7);
  });

  it("pageSize 配置：请求参数与 size 初值一致", async () => {
    const fetch = vi.fn(async () => ok([]));
    const list = makeList(fetch, { pageSize: 20 });
    expect(list.size.value).toBe(20);
    await list.load();
    expect(fetch).toHaveBeenLastCalledWith({ page: 1, size: 20 });
  });
});
