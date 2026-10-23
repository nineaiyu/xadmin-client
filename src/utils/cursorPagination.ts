import { isSuccess } from "@/api/types";
import type { ListResult } from "@/api/types";

type ListParams = Record<string, unknown>;
type ListApi = {
  list?: (params?: object) => Promise<ListResult<unknown>>;
};

/**
 * 给列表 API 挂 cursor 深分页：顺序翻页用上一页的 next_cursor 走 keyset，
 * 跳页/改排序/首次进入回退 page 模式。返回对象以原 API 为原型，保留全部
 * 原型方法（fields / columns / choices 等）。
 *
 * 约定：后端 page 模式也返回 next_cursor；cursor 模式可能省略 total，
 * 此时沿用最近一次 page 模式的 total（首屏或跳页一定会拿到）。
 */
export function withCursorPagination<T extends object>(api: T): T {
  const baseList = (api as ListApi).list;
  if (!baseList) return api;

  const cursors = new Map<number, string>();
  let lastTotal: number | null = null;
  let lastSignature = "";

  const list = (params: object = {}) => {
    const source = params as ListParams;
    const page = Number(source.page ?? 1);
    const signature = JSON.stringify(
      Object.keys(source)
        .filter(key => key !== "page" && key !== "cursor")
        .sort()
        .map(key => [key, source[key]])
    );
    if (signature !== lastSignature) {
      cursors.clear();
      lastTotal = null;
      lastSignature = signature;
    }

    const query: ListParams = { ...source };
    const cursor = cursors.get(page);
    // 自定义排序下 keyset 边界不稳定：回退 page 模式
    if (!source.ordering && cursor) {
      delete query.page;
      query.cursor = cursor;
    }

    return baseList.call(api, query).then(res => {
      if (isSuccess(res) && res.data) {
        if (typeof res.data.total === "number") lastTotal = res.data.total;
        if (res.data.total == null && lastTotal != null) {
          res.data.total = lastTotal;
        }
        if (res.data.total == null) {
          res.data.total = res.data.results?.length ?? 0;
        }
        if (res.data.next_cursor) {
          cursors.set(page + 1, res.data.next_cursor);
        } else {
          cursors.delete(page + 1);
        }
      }
      return res;
    });
  };

  const wrapper = Object.create(api) as T & ListApi;
  wrapper.list = list;
  return wrapper;
}
