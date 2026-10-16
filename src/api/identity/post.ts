import { BaseApi } from "@/api/base";
import type { BaseResult, DataListResult, DetailResult } from "@/api/types";
import type {
  PostPreviewResult,
  PreviewDetailResult
} from "@/api/types/permission-preview";

/** 岗位（人员维度，不参与权限判定；成员为多对多关联） */
export interface PostItem {
  pk: string;
  name: string;
  code: string;
  dept: number | null;
  dept_name: string;
  rank: number;
  is_active: boolean;
  user_count: number;
  description: string | null;
  updated_time: string;
}

/** 岗位成员简要信息 */
export interface PostMemberItem {
  pk: number;
  username: string;
  nickname: string;
}

/** 选人候选项（与后端 user-options 同形状） */
export interface PostUserOption {
  pk: number;
  username: string;
  nickname?: string;
}

class PostApi extends BaseApi {
  /** 岗位维度预览（岗位信息 + 成员采样，preview 权限点） */
  preview = (pk: number | string) => {
    return this.request<PreviewDetailResult<PostPreviewResult>>(
      "get",
      {},
      {},
      `${this.baseApi}/${pk}/preview`
    );
  };
  /** 岗位成员（查看） */
  members = (pk: number | string) => {
    return this.request<DetailResult<{ members: PostMemberItem[] }>>(
      "get",
      {},
      {},
      `${this.baseApi}/${pk}/members`
    );
  };
  /** 岗位成员分配：增量 add / remove（幂等） */
  assign = (
    pk: number | string,
    data: { add?: Array<number | string>; remove?: Array<number | string> }
  ) => {
    return this.request<
      DetailResult<{
        members: PostMemberItem[];
        total: number;
        truncated: boolean;
        skipped: string[];
      }>
    >("post", {}, data, `${this.baseApi}/${pk}/assign`);
  };
  /** 成员候选：按关键字搜索在用用户（≤20 条，list 权限同口径） */
  userOptions = (keyword: string) => {
    return this.request<DataListResult<PostUserOption>>(
      "get",
      { keyword },
      {},
      `${this.baseApi}/user-options`
    );
  };
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
}

export const postApi = new PostApi("/api/identity/posts");
