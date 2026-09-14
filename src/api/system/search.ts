import { BaseApi } from "@/api/base";

export const searchDeptApi = new BaseApi("/api/system/search/dept");
export const searchUserApi = new BaseApi("/api/system/search/user");
export const searchRoleApi = new BaseApi("/api/system/search/role");
export const searchMenuApi = new BaseApi("/api/system/search/menu");

/** 全局搜索单条结果 */
export interface GlobalSearchItem {
  pk: string;
  /** 主展示文本 */
  text: string;
  meta: Record<string, string | number | null>;
}

/** 全局搜索分组（同一实体的命中集合，逐实体过页面权限门 + 数据权限门） */
export interface GlobalSearchGroup {
  key: string;
  label: string;
  /** 命中后的跳转路由 */
  route: string;
  total: number;
  items: GlobalSearchItem[];
}

export interface GlobalSearchResult {
  code: number;
  detail?: string;
  data: {
    keyword: string;
    groups: GlobalSearchGroup[];
  };
}

/** 全局搜索：跨实体关键词检索，顶栏统一入口 */
export const globalSearchApi = new BaseApi("/api/system/global-search");

export function searchGlobal(
  keyword: string,
  scope?: string
): Promise<GlobalSearchResult> {
  const params: Record<string, string> = { keyword };
  if (scope) params.scope = scope;
  return globalSearchApi.list(params) as unknown as Promise<GlobalSearchResult>;
}
