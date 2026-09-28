import { BaseApi } from "@/api/base";
import type { BaseResult, DataListResult, DetailResult } from "@/api/types";

/** 权限码生成载荷（dry_run=true 时 data 为预览、false 时 data 为 null） */
export interface MenuPermissionPreviewItem {
  action: "create" | "update";
  name: string;
  path: string;
  method: string;
  title: string;
}

export interface MenuPermissionPreview {
  results: MenuPermissionPreviewItem[];
  create_count: number;
  update_count: number;
}

export interface MenuPermissionPayload {
  views: string[];
  component?: string;
  skip_existing?: boolean;
  dry_run?: boolean;
}

/** 权限检测问题类型：正向缺口 / 游离权限点 / 重复权限码 */
export type MenuPermissionAuditProblem = "missing" | "orphan" | "duplicate";

/** 权限检测条目（后端计算，前端只读渲染；suggestion 映射本地化建议文案） */
export interface MenuPermissionAuditItem {
  problem: MenuPermissionAuditProblem;
  /** 权限标识；正向缺口为建议 code（可空） */
  code: string;
  method: string;
  path: string;
  /** 所在（或建议归属）菜单名称 */
  menu: string;
  /** 命中的库内权限点 pk；正向缺口为 null */
  pk: string | null;
  /** 缺口所属后端视图类名（仅缺口非空） */
  view: string;
  suggestion: "generate" | "verify" | "merge";
}

export interface MenuPermissionAuditResult {
  summary: {
    missing: number;
    orphan: number;
    duplicate: number;
    total: number;
    routes: number;
    permissions: number;
  };
  missing: MenuPermissionAuditItem[];
  orphan: MenuPermissionAuditItem[];
  duplicate: MenuPermissionAuditItem[];
}

class MenuApi extends BaseApi {
  /** 自动生成权限点：dry_run 只预览（与执行共用后端构造逻辑），不落库 */
  permissions = (pk: string | number, data: MenuPermissionPayload) => {
    return this.request<DetailResult<MenuPermissionPreview | null>>(
      "post",
      {},
      data,
      `${this.baseApi}/${pk}/permissions`
    );
  };
  /** 菜单权限检测：只读报告缺口 / 游离权限点 / 重复权限码 */
  permissionAudit = () => {
    return this.request<DetailResult<MenuPermissionAuditResult>>(
      "get",
      {},
      {},
      `${this.baseApi}/permission-audit`
    );
  };
  rank = (data?: object) => {
    return this.request<BaseResult>("post", {}, data, `${this.baseApi}/rank`);
  };
  apiUrl = () => {
    return this.request<DataListResult>(
      "get",
      {},
      {},
      `${this.baseApi}/api-url`
    );
  };
  /** 批量更新（白名单：is_active）：逐项走序列化器校验，部分成功语义 */
  batchUpdate = (
    pks: Array<number | string>,
    fields: Record<string, unknown>,
    marker = "batchUpdate"
  ) => {
    return this.request<BaseResult>(
      "post",
      {},
      { pks, fields, _write_marker: marker },
      `${this.baseApi}/batch-update`
    );
  };
}

export const menuApi = new MenuApi("/api/system/menu");
