import { BaseApi } from "@/api/base";
import type { DetailResult } from "@/api/types";

/** 通用标签中心：标签定义 + 对象打标 */
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

/**
 * 可打标资源键（与后端 TAGGABLE_MODELS 白名单同源，白名单键即唯一事实源）：
 * 各页面打标入口统一从这取 resource，避免字面量散落各处拼错后静默打不上。
 */
export const TAGGABLE_RESOURCE = {
  user: "system.userinfo",
  file: "system.uploadfile",
  approvalInstance: "approval.approvalinstance"
} as const;

class TagApi extends BaseApi {
  /** 可打标对象白名单（动态数据源：页面 resource 键取自 TAGGABLE_RESOURCE 常量，本端点供白名单展示/选择器类功能扩展用） */
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
