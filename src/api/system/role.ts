import { BaseApi } from "@/api/base";
import type { BaseResult } from "@/api/types";
import type {
  PreviewDetailResult,
  RolePreviewResult
} from "@/api/types/permission-preview";

class RoleApi extends BaseApi {
  /** F-1 批量更新：对选中行统一写入同组字段值 */
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
  /** 角色授权预览（授权菜单树/字段权限/持有用户采样） */
  preview = (pk: number | string) => {
    return this.request<PreviewDetailResult<RolePreviewResult>>(
      "get",
      {},
      {},
      `${this.baseApi}/${pk}/preview`
    );
  };
}

export const roleApi = new RoleApi("/api/system/role");
