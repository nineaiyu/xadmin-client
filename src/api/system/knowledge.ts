import { BaseApi } from "@/api/base";
import type { DetailResult } from "@/api/types";

/** AI 知识库文档（ADR-033）：仓库同步 + 管理端上传两类来源 */
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
}

export const knowledgeApi = new KnowledgeApi(
  "/api/system/ai/knowledge-documents"
);
