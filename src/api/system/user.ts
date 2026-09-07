import { BaseApi } from "@/api/base";
import type { BaseResult } from "@/api/types";
import type {
  PreviewDetailResult,
  TrialResult,
  UserPreviewResult
} from "@/api/types/permission-preview";
import type { PureHttpRequestConfig } from "@/utils/http/types";
import { http } from "@/utils/http";

class UserApi extends BaseApi {
  upload = (
    pk?: number | string,
    data?: object,
    action?: string,
    config?: PureHttpRequestConfig
  ) => {
    return http.upload<BaseResult, object>(
      `${this.baseApi}/${pk}/${action ?? "upload"}`,
      {},
      data,
      config
    );
  };
  resetPassword = (pk: number | string, data?: object) => {
    return this.request<BaseResult>(
      "post",
      {},
      data,
      `${this.baseApi}/${pk}/reset-password`
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
  unblock = (pk: number | string, data?: object) => {
    return this.request<BaseResult>(
      "post",
      {},
      data,
      `${this.baseApi}/${pk}/unblock`
    );
  };
  resetMfa = (pk: number | string, data?: object) => {
    return this.request<BaseResult>(
      "post",
      {},
      data,
      `${this.baseApi}/${pk}/reset-mfa`
    );
  };
  logout = (pk: number | string, data?: object) => {
    return this.request<BaseResult>(
      "post",
      {},
      data,
      `${this.baseApi}/${pk}/logout`
    );
  };
  /** 用户三层权限预览（可见菜单/API 码/数据权限/字段权限） */
  preview = (pk: number | string) => {
    return this.request<PreviewDetailResult<UserPreviewResult>>(
      "get",
      {},
      {},
      `${this.baseApi}/${pk}/preview`
    );
  };
  /** 数据权限实时试算（命中行数 + 最终 SQL） */
  previewTrial = (
    pk: number | string,
    data?: { model: string; menu?: string | null }
  ) => {
    return this.request<PreviewDetailResult<TrialResult>>(
      "post",
      {},
      data,
      `${this.baseApi}/${pk}/preview/trial`
    );
  };
}

export const userApi = new UserApi("/api/system/user");
