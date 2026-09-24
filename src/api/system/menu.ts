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
