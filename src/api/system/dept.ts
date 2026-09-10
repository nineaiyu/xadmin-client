import { BaseApi } from "@/api/base";
import type { BaseResult } from "@/api/types";
import type {
  DeptPreviewResult,
  PreviewDetailResult
} from "@/api/types/permission-preview";

class DeptApi extends BaseApi {
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
}

export const deptApi = new DeptApi("/api/system/dept");
