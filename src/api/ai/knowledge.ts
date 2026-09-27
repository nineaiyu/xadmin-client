import { BaseApi } from "@/api/base";
import type { DetailResult } from "@/api/types";

/** AI 知识库文档：仓库同步 + 管理端上传两类来源 */
export type KnowledgeSourceType = "repo" | "upload";

export type KnowledgeDocumentItem = {
  pk: string;
  title: string;
  source_type: KnowledgeSourceType;
  path: string;
  chunk_count: number;
  is_active: boolean;
  creator?: { pk?: string; username?: string } | null;
  synced_at: string;
  created_time: string;
  updated_time?: string;
};

export type KnowledgeChunkPreview = {
  index: number;
  size: number;
  preview: string;
};

export type KnowledgeDocumentDetail = KnowledgeDocumentItem & {
  content: string;
  chunks: KnowledgeChunkPreview[];
};

export type KnowledgeSyncSummary = {
  created: number;
  updated: number;
  removed: number;
  total: number;
  synced_at: string;
};

/**
 * 向量通道状态：enabled 表示存在可用的 embedding 档案（用途=文本向量化）；
 * fresh 为可直接参与检索的向量数，stale 为正文/模型变更后待重算的向量数。
 */
export type KnowledgeVectorStatus = {
  enabled: boolean;
  model: string;
  dim: number;
  total: number;
  embedded: number;
  fresh: number;
  stale: number;
};

export type KnowledgeEmbeddingSummary = {
  enabled: boolean;
  ok: boolean;
  model: string;
  dim: number;
  total: number;
  embedded: number;
  skipped: number;
  failed: number;
  detail: string;
};

class KnowledgeApi extends BaseApi {
  /** 上传文档（文本）：同名视为覆盖更新，上传后立即参与问答检索 */
  upload = (name: string, content: string) => {
    return this.request<DetailResult>("post", {}, { name, content });
  };

  /** 重新扫描仓库文档（docs/）：上传文档不受影响 */
  syncRepo = () => {
    return this.request<DetailResult>(
      "post",
      {},
      {},
      `${this.baseApi}/sync-repo`
    );
  };

  /** 批量启用/停用（停用移除分块退出检索；批量删除走框架 api.batchDestroy） */
  batchToggle = (pks: Array<string | number>, isActive: boolean) => {
    return this.request<DetailResult>(
      "post",
      {},
      { pks, is_active: isActive },
      `${this.baseApi}/batch-toggle`
    );
  };

  /** 向量通道状态（是否启用 / 模型 / 维度 / 已构建与陈旧条数） */
  vectorStatus = () => {
    return this.request<DetailResult<KnowledgeVectorStatus>>(
      "get",
      {},
      {},
      `${this.baseApi}/vector-status`
    );
  };

  /**
   * 构建/刷新知识块向量（幂等：只补缺失与陈旧块）：
   * 需已配置「用途=文本向量化」的激活档案，未配置时返回 1001。
   */
  buildEmbeddings = (params: { force?: boolean; document?: string } = {}) => {
    return this.request<DetailResult<KnowledgeEmbeddingSummary>>(
      "post",
      {},
      { ...params },
      `${this.baseApi}/build-embeddings`
    );
  };
}

export const knowledgeApi = new KnowledgeApi("/api/ai/knowledge-documents");
