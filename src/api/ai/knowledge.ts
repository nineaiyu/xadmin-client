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

/** 向量构建运行状态（轮询端点；终态摘要随状态通道保留 1 小时） */
export type KnowledgeBuildStatus = {
  state: "idle" | "running" | "done" | "error";
  percent: number;
  stage?: string;
  embedded?: number;
  total?: number;
  updated_time?: string;
  finished_time?: string;
  summary?: Partial<KnowledgeEmbeddingSummary>;
};

class KnowledgeApi extends BaseApi {
  /** 上传文档：文本直传（content）或二进制解析（file_type + file_b64，pdf/docx）；
   * 同名视为覆盖更新，上传后立即参与问答检索 */
  upload = (
    name: string,
    payload:
      { content: string } | { file_type: "pdf" | "docx"; file_b64: string }
  ) => {
    return this.request<DetailResult>("post", {}, { name, ...payload });
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
   * 提交向量构建后台任务（异步；幂等补缺失与陈旧块）：
   * 需已配置「用途=文本向量化」的激活档案，未配置/已有构建在跑时返回 1001。
   * 进度经 buildEmbeddingsStatus 轮询。
   */
  buildEmbeddings = (params: { force?: boolean; document?: string } = {}) => {
    return this.request<DetailResult<{ task_id?: string; state: string }>>(
      "post",
      {},
      { ...params },
      `${this.baseApi}/build-embeddings`
    );
  };

  /** 向量构建运行状态（轮询）：running 期间 percent 推进，终态带 summary。 */
  buildEmbeddingsStatus = () => {
    return this.request<DetailResult<KnowledgeBuildStatus>>(
      "get",
      {},
      {},
      `${this.baseApi}/build-embeddings/status`
    );
  };
}

export const knowledgeApi = new KnowledgeApi("/api/ai/knowledge-documents");
