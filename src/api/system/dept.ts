import { BaseApi } from "@/api/base";
import type { BaseResult, DataListResult, DetailResult } from "@/api/types";
import type {
  DeptPreviewResult,
  PreviewDetailResult
} from "@/api/types/permission-preview";

/** 部门管理员条目（列表 managers 列 / 任命弹窗共用） */
export interface DeptManagerItem {
  pk: number;
  username: string;
  nickname?: string;
}

/** 我的管辖：部门条目 */
export interface ManagedDeptItem {
  pk: string;
  name: string;
  code: string;
  parent_id: string | null;
  user_count: number;
  /** 直接任命（非下级展开） */
  is_direct: boolean;
}

/** 我的管辖：部门清单与统计 */
export interface ManagedScopeResult {
  depts: ManagedDeptItem[];
  dept_count: number;
  user_count: number;
}

class DeptApi extends BaseApi {
  /** 批量更新：对选中行统一写入同组字段值 */
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
  empower = (pk: number | string, data?: object) => {
    return this.request<BaseResult>(
      "post",
      {},
      data,
      `${this.baseApi}/${pk}/empower`
    );
  };
  /** 部门授权预览（挂载角色 / 数据权限 / 字段权限 / 成员采样） */
  preview = (pk: number | string) => {
    return this.request<PreviewDetailResult<DeptPreviewResult>>(
      "get",
      {},
      {},
      `${this.baseApi}/${pk}/preview`
    );
  };
  /** 部门管理员任命：增量 add / remove（幂等，同步装配预置角色与数据权限规则） */
  assignManagers = (
    pk: number | string,
    data: { add?: Array<number | string>; remove?: Array<number | string> }
  ) => {
    return this.request<DetailResult<{ managers: DeptManagerItem[] }>>(
      "post",
      {},
      data,
      `${this.baseApi}/${pk}/assign-managers`
    );
  };
  /** 管理员候选：按关键字搜索在用用户（≤20 条，list 权限同口径） */
  userOptions = (keyword: string) => {
    return this.request<DataListResult<DeptManagerItem>>(
      "get",
      { keyword },
      {},
      `${this.baseApi}/user-options`
    );
  };
  /** 我的管辖：本人任管理员的部门（含下级）与统计（只读） */
  managed = () => {
    return this.request<DetailResult<ManagedScopeResult>>(
      "get",
      {},
      {},
      `${this.baseApi}/managed`
    );
  };
}

export const deptApi = new DeptApi("/api/system/dept");
