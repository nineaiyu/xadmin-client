<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import type { AiToolItem } from "@/api/ai/ai";

/** 指令执行入口的工具目录（只读）：名称 / 描述 / 参数清单 */
defineOptions({ name: "AiToolCatalog" });

defineProps<{ tools: AiToolItem[] }>();

const { t } = useI18n();
</script>

<template>
  <div data-testid="ai-tool-catalog">
    <el-empty v-if="!tools.length" :description="t('ai.toolCatalogEmpty')" />
    <div v-else class="space-y-4">
      <div v-for="tool in tools" :key="tool.name">
        <div class="font-medium">{{ tool.name }}</div>
        <div class="text-sm text-(--el-text-color-regular)">
          {{ tool.description }}
        </div>
        <div class="mt-1 text-xs text-(--el-text-color-secondary)">
          {{ t("ai.toolParams") }}:
          {{
            Object.keys(tool.inputSchema?.properties ?? {}).join(", ") || "-"
          }}
        </div>
      </div>
    </div>
  </div>
</template>
