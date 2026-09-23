import { BaseApi } from "@/api/base";
import type { DetailResult } from "@/api/types";

/** 通用标签中心（P-1）：标签定义 + 对象打标 */
export type TagItem = {
  pk: string;
  name: string;
  color?: string;
  builtin?: boolean;
  remark?: string;
  usage_count?: number;
  creator?: { pk?: number; username?: string } | null;
  created_time?: string;
  updated_time?: string;
};

/** 可打标对象白名单项（资源键 → 展示名） */
export type TaggableResource = {
  key: string;
  label: string;
};

/** 打标载荷：全量替换语义 */
export type TagAssignPayload = {
  resource: string;
  pk: string;
  tags: string[];
};

export type TagBatchAssignPayload = {
  resource: string;
  pks: string[];
  tags: string[];
  mode?: "replace" | "add" | "remove";
};

export type TagBatchAssignResult = {
  success: { pk: string; tags: TagItem[] }[];
  failures: { pk: string; reason: string }[];
};

class TagApi extends BaseApi {
  /** 可打标对象白名单 */
  getResources = () => {
    return this.request<DetailResult<{ resources: TaggableResource[] }>>(
      "get",
      {},
      {},
      `${this.baseApi}/resources`
    );
  };

  /** 查询某对象的标签 */
  getObjectTags = (resource: string, pk: string) => {
    return this.request<DetailResult<{ tags: TagItem[] }>>(
      "get",
      { resource, pk },
      {},
      `${this.baseApi}/objects`
    );
  };

  /** 单对象打标（全量替换） */
  assign = (payload: TagAssignPayload) => {
    return this.request<DetailResult<{ tags: TagItem[] }>>(
      "post",
      {},
      payload,
      `${this.baseApi}/assign`
    );
  };

  /** 批量打标（replace/add/remove） */
  batchAssign = (payload: TagBatchAssignPayload) => {
    return this.request<DetailResult<TagBatchAssignResult>>(
      "post",
      {},
      payload,
      `${this.baseApi}/batch-assign`
    );
  };
}

export const tagApi = new TagApi("/api/system/tags");
