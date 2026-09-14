import { describe, expect, it, vi } from "vitest";

import { fetchAllRows } from "./fetchAllRows";
import type { ListResult } from "@/api/types";

type Row = { pk: number; name: string };

const row = (pk: number): Row => ({ pk, name: `row-${pk}` });

/** 造一页响应；results 由调用方给定 */
const pageRes = (
  results: Row[],
  total: number,
  extra: Partial<Pick<ListResult<Row>["data"], "total">> = {}
): ListResult<Row> =>
  ({
    detail: "",
    code: 1000,
    data: { results, total, ...extra }
  }) as ListResult<Row>;

/** 按请求的 page/size 切片返回，模拟后端分页（可模拟 max_page_size 截断） */
function makePagedApi(rows: Row[], opts: { maxPageSize?: number } = {}) {
  const calls: Array<Record<string, unknown>> = [];
  const list = vi.fn(async (params: Record<string, unknown>) => {
    calls.push(params);
    const requested = Number(params.size ?? 20);
    // max_page_size < size 时模拟后端截断行为
    const size = opts.maxPageSize
      ? Math.min(requested, opts.maxPageSize)
      : requested;
    const page = Number(params.page ?? 1);
    const start = (page - 1) * size;
    return pageRes(rows.slice(start, start + size), rows.length);
  });
  return { list, calls };
}

describe("fetchAllRows", () => {
  it("数据量小于单页时只发一次请求", async () => {
    const rows = [row(1), row(2)];
    const { list, calls } = makePagedApi(rows);
    const res = await fetchAllRows(list as never);
    expect(list).toHaveBeenCalledTimes(1);
    expect(calls[0]).toMatchObject({ page: 1, size: 1000 });
    expect(res.code).toBe(1000);
    expect(res.data.results).toEqual(rows);
    expect(res.data.total).toBe(2);
  });

  it("数据量超过单页时逐页循环拉取并合并（后端 max_page_size 截断场景）", async () => {
    // 350 条、后端 max_page_size=100：size=1000 被截断为 100，必须翻 4 页
    const rows = Array.from({ length: 350 }, (_, i) => row(i + 1));
    const { list, calls } = makePagedApi(rows, { maxPageSize: 100 });
    const res = await fetchAllRows(list as never);
    expect(list).toHaveBeenCalledTimes(4);
    expect(calls.map(call => call.page)).toEqual([1, 2, 3, 4]);
    expect(res.data.results).toEqual(rows);
    expect(res.data.total).toBe(350);
  });

  it("total 恰好拉满后不再多请求一页", async () => {
    const rows = Array.from({ length: 2000 }, (_, i) => row(i + 1));
    const { list } = makePagedApi(rows);
    const res = await fetchAllRows(list as never);
    expect(list).toHaveBeenCalledTimes(2);
    expect(res.data.results).toHaveLength(2000);
  });

  it("query 过滤参数在每一页请求中透传", async () => {
    const rows = Array.from({ length: 1500 }, (_, i) => row(i + 1));
    const { list, calls } = makePagedApi(rows);
    await fetchAllRows(list as never, { field_type: 2, parent: 0 });
    expect(calls.length).toBeGreaterThan(1);
    calls.forEach(call => {
      expect(call).toMatchObject({ field_type: 2, parent: 0 });
    });
  });

  it("翻页请求剥离 with_meta，仅首页携带", async () => {
    const rows = Array.from({ length: 1500 }, (_, i) => row(i + 1));
    const { list, calls } = makePagedApi(rows);
    await fetchAllRows(list as never, { with_meta: 1 });
    expect(calls[0]).toMatchObject({ with_meta: 1 });
    calls.slice(1).forEach(call => {
      expect(call).not.toHaveProperty("with_meta");
    });
  });

  it("首页业务失败（code !== 1000）原样返回，不翻页", async () => {
    const failed = {
      detail: "forbidden",
      code: 4001,
      data: null
    } as unknown as ListResult<Row>;
    const list = vi.fn(async () => failed);
    const res = await fetchAllRows(list as never);
    expect(list).toHaveBeenCalledTimes(1);
    expect(res).toEqual(failed);
  });

  it("翻页中途业务失败时抛出异常，不返回残缺数据", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => row(i + 1));
    const list = vi.fn(async (params: Record<string, unknown>) => {
      if (Number(params.page) === 2) {
        return {
          detail: "boom",
          code: 4001,
          data: null
        } as unknown as ListResult<Row>;
      }
      const page = Number(params.page ?? 1);
      return pageRes(rows.slice((page - 1) * 1000, page * 1000), rows.length);
    });
    await expect(fetchAllRows(list as never)).rejects.toThrow("boom");
  });

  it("翻页中途请求异常（reject）时照常抛出", async () => {
    const list = vi.fn(async (params: Record<string, unknown>) => {
      if (Number(params.page) === 2) throw new Error("network");
      return pageRes([row(1)], 2000);
    });
    await expect(fetchAllRows(list as never)).rejects.toThrow("network");
  });

  it("total 缺失时以空页兜底终止", async () => {
    let calls = 0;
    const list = vi.fn(async () => {
      calls += 1;
      return pageRes(calls === 1 ? [row(1)] : [], undefined as never);
    });
    const res = await fetchAllRows(list as never);
    expect(calls).toBe(2);
    expect(res.data.results).toEqual([row(1)]);
    // total 未下发时回填为实际合并条数
    expect(res.data.total).toBe(1);
  });

  it("超过 maxPages 保护上限时停止翻页（防御 total 异常死循环）", async () => {
    const rows = Array.from({ length: 3000 }, (_, i) => row(i + 1));
    const list = vi.fn(async () => {
      // 故意谎报 total 为超大值，模拟 total 异常
      return pageRes(rows.slice(0, 1000), 10 ** 9);
    });
    const res = await fetchAllRows(list as never, {}, { maxPages: 3 });
    // maxPages=3：3 页 × 每页 1000 条后强制停止，不再继续请求
    expect(list).toHaveBeenCalledTimes(3);
    expect(res.data.results).toHaveLength(3000);
  });
});
