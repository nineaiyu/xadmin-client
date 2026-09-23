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

  /** 邀请激活：重置为待激活并发送一次性链接邮件（已激活账号密码将立即失效） */
  invite = (pk: number | string, data?: object) => {
    return this.request<BaseResult>(
      "post",
      {},
      data,
      `${this.baseApi}/${pk}/invite`
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
  /** 管理员查看某用户的 IM 绑定列表（免扫码代录的读侧） */
  imBindingList = (pk: number | string) => {
    return this.request<{
      code: number;
      detail: string;
      data: Array<{
        pk: string;
        provider: string;
        subject: string;
        profile: Record<string, unknown>;
      }>;
    }>("get", {}, {}, `${this.baseApi}/${pk}/im-binding`);
  };
  /** 管理员代录 IM 身份（免扫码）：创建或更新绑定 */
  imBinding = (
    pk: number | string,
    data: { provider: string; subject: string; nickname?: string }
  ) => {
    return this.request<{
      code: number;
      detail: string;
      data: { pk: string; created: boolean };
    }>("post", {}, data, `${this.baseApi}/${pk}/im-binding`);
  };
  /** 管理员解绑 IM 身份（防自锁：仅剩此登录方式时后端拒绝） */
  imUnbind = (pk: number | string, provider: string) => {
    return this.request<{ code: number; detail: string }>(
      "post",
      {},
      { provider },
      `${this.baseApi}/${pk}/im-unbind`
    );
  };
}

export const userApi = new UserApi("/api/system/user");
