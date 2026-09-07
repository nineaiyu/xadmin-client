import { BaseApi } from "@/api/base";
import type {
  PreviewDetailResult,
  RolePreviewResult
} from "@/api/types/permission-preview";

class RoleApi extends BaseApi {
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
