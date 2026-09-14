import { SUCCESS_CODE, type ListResult } from "@/api/types";
import type { RecordType } from "plus-pro-components";

/** 单页条数：与后端 `DynamicPageNumber(1000)` 的分页上限对齐 */
const DEFAULT_PAGE_SIZE = 1000;
/** 翻页防御上限（页）：total 异常时避免无限循环 */
const DEFAULT_MAX_PAGES = 200;

type ListFetcher<T, R extends ListResult<T>> = (
  params: Record<string, unknown>
) => Promise<R>;

export interface FetchAllRowsOptions {
  /** 单页条数（默认 1000，与后端分页上限对齐） */
  pageSize?: number;
  /** 最大页数保护（默认 200，防御 total 异常导致的死循环） */
  maxPages?: number;
}

/**
 * 分页循环拉取列表接口的全量数据。
 *
 * 背景：下拉/树选项等场景需要「全量」数据，此前普遍用
 * `list({ page: 1, size: 1000 })` 一次拉取——数据量一旦超过接口的分页上限
 * 即被截断遗漏（后端默认 `max_page_size=100`，部分视图集为 1000）。
 * 本函数以 `data.total` 为准逐页循环拉取并合并，保证拿到完整数据。
 *
 * 语义约定：
 * - 返回值保持 `ListResult` 响应形状（`results` 为全量合并结果、`total` 为
 *   全量条数），调用方原有的 `res.code === 1000` / `res.data.results`
 *   分支逻辑无需改动；
 * - 首页业务失败（`code !== 1000`）原样返回响应，由调用方既有错误分支提示；
 * - 翻页中途失败抛出异常（绝不静默返回残缺数据），由调用方 catch；
 * - `with_meta` 等内联元数据参数仅在首页携带，翻页请求自动剥离。
 */
export async function fetchAllRows<
  T = RecordType,
  R extends ListResult<T> = ListResult<T>
>(
  list: ListFetcher<T, R>,
  query: Record<string, unknown> = {},
  options: FetchAllRowsOptions = {}
): Promise<R> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;

  const pageParams = (page: number): Record<string, unknown> => {
    const params: Record<string, unknown> = { ...query, page, size: pageSize };
    // 内联元数据载荷较大，仅首页需要；翻页请求剥离
    if (page > 1) delete params.with_meta;
    return params;
  };

  const first = await list(pageParams(1));
  // 业务失败（权限不足/服务异常）：原样返回，调用方既有 code/detail 分支照常提示
  if (first.code !== SUCCESS_CODE || !first.data) return first;

  const rows: T[] = [...(first.data.results ?? [])];
  // 后端各接口 max_page_size 不一（默认 100、部分视图集 1000），请求的 size
  // 可能被截断，翻页进度必须以 total 为准，不能用「本页条数 < size」判断
  let total = first.data.total;
  let page = 1;
  while (page < maxPages) {
    if (typeof total === "number" && rows.length >= total) break;
    page += 1;
    const next = await list(pageParams(page));
    if (next.code !== SUCCESS_CODE || !next.data) {
      throw new Error(next.detail || "fetchAllRows: page request failed");
    }
    const chunk = next.data.results ?? [];
    // total 缺失/异常时以「空页」兜底终止，避免空转
    if (chunk.length === 0) break;
    rows.push(...chunk);
    if (typeof total !== "number" && typeof next.data.total === "number") {
      total = next.data.total;
    }
  }

  return {
    ...first,
    data: {
      ...first.data,
      results: rows,
      total: typeof total === "number" ? total : rows.length
    }
  } as R;
}
