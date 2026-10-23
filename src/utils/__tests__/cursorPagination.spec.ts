import { describe, expect, it, vi } from "vitest";

import { withCursorPagination } from "../cursorPagination";

type Params = Record<string, unknown>;

const response = (page: number, total: number | undefined, next?: string) => ({
  code: 1000,
  detail: "",
  data: {
    results: [{ page }],
    total,
    next_cursor: next,
    has_more: Boolean(next)
  }
});

const createApi = () => {
  const calls: Params[] = [];
  const api = {
    marker: "api",
    fields: vi.fn(),
    list: vi.fn((params: Params = {}) => {
      calls.push(params);
      if (params.cursor) return Promise.resolve(response(2, undefined, "c3"));
      if (params.page === 2) return Promise.resolve(response(2, 5, "c3"));
      return Promise.resolve(response(1, 5, "c2"));
    })
  };
  return { api, calls };
};

describe("withCursorPagination", () => {
  it("顺序翻页用 next_cursor，cursor 页沿用上一页 total", async () => {
    const { api, calls } = createApi();
    const wrapped = withCursorPagination(api);

    const first = await wrapped.list({ page: 1, size: 2, path: "/x" });
    expect(calls.at(-1)).toEqual({ page: 1, size: 2, path: "/x" });
    expect(first.data.total).toBe(5);

    const second = await wrapped.list({ page: 2, size: 2, path: "/x" });
    expect(calls.at(-1)).toEqual({ size: 2, path: "/x", cursor: "c2" });
    expect(second.data.total).toBe(5);

    await wrapped.list({ page: 3, size: 2, path: "/x" });
    expect(calls.at(-1)).toEqual({ size: 2, path: "/x", cursor: "c3" });
  });

  it("筛选变化清空游标；未访问页回退 page 模式", async () => {
    const { api, calls } = createApi();
    const wrapped = withCursorPagination(api);

    await wrapped.list({ page: 1, size: 2, path: "/x" });
    await wrapped.list({ page: 2, size: 2, path: "/x" });
    expect(calls.at(-1)).toMatchObject({ cursor: "c2" });

    await wrapped.list({ page: 1, size: 2, path: "/y" });
    await wrapped.list({ page: 3, size: 2, path: "/y" });
    expect(calls.at(-1)).toEqual({ page: 3, size: 2, path: "/y" });
  });

  it("自定义排序不使用 cursor", async () => {
    const { api, calls } = createApi();
    const wrapped = withCursorPagination(api);

    await wrapped.list({ page: 1, size: 2, ordering: "created_time" });
    await wrapped.list({ page: 2, size: 2, ordering: "created_time" });
    expect(calls.at(-1)).toEqual({
      page: 2,
      size: 2,
      ordering: "created_time"
    });
  });

  it("以原 API 为原型，保留 fields 等原型/实例方法", () => {
    const { api } = createApi();
    const wrapped = withCursorPagination(api);
    expect(wrapped.fields).toBe(api.fields);
    expect(wrapped.marker).toBe("api");
  });
});
