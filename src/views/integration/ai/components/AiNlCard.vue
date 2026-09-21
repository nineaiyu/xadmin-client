<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { NlInterpretResult } from "@/api/system/ai";

/**
 * NL 查询解释卡片：数据集 / 预览行数 / 模式 / 过滤条件摘要。
 *
 * 运行按钮仅在「该卡片仍是当前消息流最后一条 assistant 消息」时展示
 * （runnable 由父级判定）：运行后结果消息追加在最后，卡片自然变为只读回看。
 */
const props = defineProps<{
  result: NlInterpretResult;
  runnable: boolean;
  running?: boolean;
}>();

const emit = defineEmits<{
  run: [dsl: NlInterpretResult["dsl"]];
}>();

const { t } = useI18n();

const filterText = computed(() => {
  const filters = props.result.dsl?.filters ?? [];
  if (!filters.length) return t("ai.nlNoFilters");
  return filters
    .map(item => `${item.field} ${item.op} ${JSON.stringify(item.value ?? "")}`)
    .join("; ");
});
</script>

<template>
  <div
    class="mt-1 w-full rounded border border-solid border-(--el-border-color-light) bg-(--el-bg-color) px-3 py-2 text-xs"
    data-testid="ai-nl-card"
  >
    <div class="flex flex-wrap items-center gap-2">
      <span class="font-semibold">
        {{ t("ai.nlDataset") }}: {{ result.dataset_name }}
      </span>
      <el-tag size="small">
        {{ t("ai.nlPreview") }}: {{ result.preview_count }}
      </el-tag>
      <el-tag size="small" type="info">
        {{
          result.mode === "aggregate"
            ? t("ai.nlModeAggregate")
            : t("ai.nlModeRows")
        }}
      </el-tag>
    </div>
    <div class="mt-1 text-(--el-text-color-secondary)">
      {{ t("ai.nlFilters") }}: {{ filterText }}
    </div>
    <div v-if="runnable" class="mt-2">
      <el-button
        type="success"
        size="small"
        data-testid="ai-nl-run"
        :loading="running"
        @click="emit('run', result.dsl)"
      >
        {{ t("ai.nlRun") }}
      </el-button>
    </div>
  </div>
</template>
