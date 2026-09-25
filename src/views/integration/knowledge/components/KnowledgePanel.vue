<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import {
  ReActionPanel,
  type PanelActionGroup
} from "@/components/ReActionPanel";
import {
  knowledgeApi,
  type KnowledgeDocumentDetail,
  type KnowledgeDocumentItem
} from "@/api/system/knowledge";

/**
 * 知识库「管理文档」抽屉：文档资料 + 启停/删除动作 + 全文与分块清单。
 *
 * - 资料卡与动作基于列表行快照立即渲染；全文/分块按需拉取详情（列表接口轻量）；
 * - 动作按钮由页面构建（权限与行级条件已在构建期收敛）；
 * - 全文按 Markdown 原文展示（与助手页回答渲染同口径：不引入 md 渲染依赖，
 *   避免第三方内容 XSS 面）；分块清单即问答检索命中的最小单元。
 */
defineOptions({ name: "IntegrationKnowledgePanel" });

const props = defineProps<{
  row: KnowledgeDocumentItem;
  groups: PanelActionGroup[];
}>();

const { t } = useI18n();

const loading = ref(true);
const detail = ref<KnowledgeDocumentDetail | null>(null);

onMounted(async () => {
  try {
    const res = await knowledgeApi.retrieve(props.row.pk);
    if (res.code === SUCCESS_CODE) {
      detail.value = res.data as unknown as KnowledgeDocumentDetail;
    }
  } finally {
    loading.value = false;
  }
});

const sourceLabel = computed(() =>
  props.row.source_type === "upload"
    ? t("aiKnowledge.sourceUpload")
    : t("aiKnowledge.sourceRepo")
);

const activeLabel = computed(() =>
  props.row.is_active ? t("aiKnowledge.enabled") : t("aiKnowledge.disabled")
);
</script>

<template>
  <ReActionPanel :groups="groups">
    <template #profile>
      <div class="doc-title">{{ row.title }}</div>
      <div class="mt-2 flex flex-wrap gap-1.5">
        <el-tag
          :type="row.source_type === 'upload' ? 'success' : 'info'"
          size="small"
          effect="plain"
        >
          {{ sourceLabel }}
        </el-tag>
        <el-tag
          :type="row.is_active ? 'success' : 'danger'"
          size="small"
          effect="plain"
        >
          {{ activeLabel }}
        </el-tag>
        <el-tag type="info" size="small" effect="plain">
          {{ t("aiKnowledge.chunkCount") }}: {{ row.chunk_count }}
        </el-tag>
      </div>
      <div class="doc-meta">
        {{ t("aiKnowledge.syncedAt") }}: {{ row.synced_at || "-" }}
      </div>
      <div class="doc-path">{{ row.path }}</div>
    </template>

    <div v-loading="loading" class="min-h-40">
      <template v-if="detail">
        <h4 class="section-title">{{ t("aiKnowledge.contentTitle") }}</h4>
        <pre class="doc-content" data-testid="knowledge-preview-content">{{
          detail.content
        }}</pre>

        <h4 class="section-title mt-4">
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
            <div class="chunk-preview">
              {{ chunk.preview }}
            </div>
          </el-collapse-item>
        </el-collapse>
      </template>
    </div>
  </ReActionPanel>
</template>

<style scoped lang="scss">
.doc-title {
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.doc-meta {
  margin-top: 8px;
  font-size: var(--el-font-size-extra-small);
  line-height: 16px;
  color: var(--el-text-color-secondary);
}

.doc-path {
  margin-top: 4px;
  font-size: var(--el-font-size-extra-small);
  line-height: 16px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}

.section-title {
  margin-bottom: 8px;
  font-size: var(--el-font-size-base);
  font-weight: 500;
  line-height: 20px;
}

.doc-content {
  max-height: 420px;
  padding: 12px;
  margin: 0;
  overflow: auto;
  font-size: var(--el-font-size-extra-small);
  line-height: 20px;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}

.chunk-preview {
  font-size: var(--el-font-size-extra-small);
  line-height: 20px;
  color: var(--el-text-color-regular);
  overflow-wrap: break-word;
  white-space: pre-wrap;
}
</style>
