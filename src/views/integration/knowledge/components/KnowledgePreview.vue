<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  knowledgeApi,
  type KnowledgeDocumentDetail
} from "@/api/system/knowledge";

/**
 * 文档预览抽屉：元信息 + 全文原文 + 分块清单。
 *
 * 全文按 Markdown 原文展示（与助手页回答渲染同口径：不引入 md 渲染依赖，
 * 避免第三方内容 XSS 面）；分块清单即问答检索命中的最小单元，可核对分块合理性。
 */
defineOptions({ name: "KnowledgePreview" });

const props = defineProps<{ pk: string }>();
const { t } = useI18n();

const loading = ref(true);
const detail = ref<KnowledgeDocumentDetail | null>(null);

onMounted(async () => {
  try {
    const res = await knowledgeApi.retrieve(props.pk);
    if (res.code === SUCCESS_CODE) {
      detail.value = res.data as unknown as KnowledgeDocumentDetail;
    }
  } finally {
    loading.value = false;
  }
});

const sourceLabel = (source?: string) =>
  source === "upload"
    ? t("aiKnowledge.sourceUpload")
    : t("aiKnowledge.sourceRepo");
</script>

<template>
  <div v-loading="loading" class="h-full">
    <template v-if="detail">
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item :label="t('aiKnowledge.title')">
          {{ detail.title }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('aiKnowledge.source')">
          <el-tag
            size="small"
            :type="detail.source_type === 'upload' ? 'success' : 'info'"
          >
            {{ sourceLabel(detail.source_type) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item :label="t('aiKnowledge.chunkCount')">
          {{ detail.chunk_count }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('aiKnowledge.syncedAt')">
          {{ detail.synced_at || "-" }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('aiKnowledge.path')" :span="2">
          <span class="text-xs text-gray-500">{{ detail.path }}</span>
        </el-descriptions-item>
      </el-descriptions>

      <h4 class="mb-2 mt-4 text-sm font-medium">
        {{ t("aiKnowledge.contentTitle") }}
      </h4>
      <pre
        class="max-h-105 overflow-auto whitespace-pre-wrap wrap-break-word rounded bg-gray-50 p-3 text-xs/5 dark:bg-(--el-fill-color-light)"
        data-testid="knowledge-preview-content"
        >{{ detail.content }}</pre>

      <h4 class="mb-2 mt-4 text-sm font-medium">
        {{ t("aiKnowledge.chunksTitle") }} ({{ detail.chunks.length }})
      </h4>
      <el-collapse>
        <el-collapse-item
          v-for="chunk in detail.chunks"
          :key="chunk.index"
          :name="chunk.index"
        >
          <template #title>
            <span class="text-xs">
              {{ t("aiKnowledge.chunkLabel", { n: chunk.index + 1 }) }} ·
              {{ t("aiKnowledge.chunkSize", { size: chunk.size }) }}
            </span>
          </template>
          <div
            class="whitespace-pre-wrap wrap-break-word text-xs text-gray-600 dark:text-gray-300"
          >
            {{ chunk.preview }}
          </div>
        </el-collapse-item>
      </el-collapse>
    </template>
  </div>
</template>
