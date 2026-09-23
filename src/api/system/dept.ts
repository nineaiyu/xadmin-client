import { BaseApi } from "@/api/base";
import type { BaseResult } from "@/api/types";
import type {
  DeptPreviewResult,
  PreviewDetailResult
} from "@/api/types/permission-preview";

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
}

export const deptApi = new DeptApi("/api/system/dept");
