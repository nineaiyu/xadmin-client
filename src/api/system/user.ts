import { BaseApi } from "@/api/base";
import type { BaseResult } from "@/api/types";
import type {
  FieldTrialResult,
  PreviewDetailResult,
  TrialDraft,
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
  /** 数据权限实时试算（命中行数 + 样本行 + 授权诊断 + 最终 SQL；draft 为未保存的规则草稿） */
  previewTrial = (
    pk: number | string,
    data?: { model: string; menu?: string | null; draft?: TrialDraft | null }
  ) => {
    return this.request<PreviewDetailResult<TrialResult>>(
      "post",
      {},
      data,
      `${this.baseApi}/${pk}/preview/trial`
    );
  };
  /** 字段权限试算（指定菜单下的生效字段矩阵；draft.fields 为未保存的白名单草稿） */
  previewFieldTrial = (
    pk: number | string,
    data?: { menu: string; draft?: TrialDraft | null }
  ) => {
    return this.request<PreviewDetailResult<FieldTrialResult>>(
      "post",
      {},
      { ...data, scope: "field" },
      `${this.baseApi}/${pk}/preview/trial`
    );
  };
}

export const userApi = new UserApi("/api/system/user");
