<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import type { ReportComponentType } from "@/api/dataset/analysis";
import type { DatasetItem } from "@/api/dataset/datasets";
import {
  REPORT_COMPONENT_TYPES,
  REPORT_TABLE_LIMIT,
  REPORT_TEMPLATES
} from "../utils/design";

/**
 * 报表设计器左栏：模板预设 + 明细列勾选 + 行数上限 + 组件库。
 *
 * 纯受控组件（值走 props、改动走 emit），勾选态展示的是「解析后的列」——
 * 设计里 columns 为空 = 全部列，因此首次取消勾选时会下发显式列清单。
 */
defineOptions({ name: "ReportDesignSidebar" });

defineProps<{
  dataset: DatasetItem | null;
  /** 解析后的明细列（空 design = 全部列） */
  columns: string[];
  tableLimit: number;
}>();

const emit = defineEmits<{
  applyTemplate: [code: string];
  columnsChange: [columns: string[]];
  limitChange: [value: number];
  addComponent: [type: ReportComponentType];
}>();

const { t } = useI18n();

const componentLabel = (type: ReportComponentType) =>
  t(`dataReport.component${type[0].toUpperCase()}${type.slice(1)}`);
</script>

<template>
  <aside class="designer-side">
    <el-select
      class="w-full"
      :placeholder="t('dataReport.template')"
      data-testid="designer-template"
      @change="emit('applyTemplate', $event)"
    >
      <el-option
        v-for="item in REPORT_TEMPLATES"
        :key="item.code"
        :value="item.code"
        :label="t(item.labelKey)"
      />
    </el-select>

    <div class="designer-side__title">{{ t("dataReport.designDetail") }}</div>
    <div class="designer-side__hint">
      {{ t("dataReport.datasetLabel") }}：{{ dataset?.name ?? "—" }}
    </div>
    <el-checkbox-group
      :model-value="columns"
      class="designer-columns"
      data-testid="designer-columns"
      @change="emit('columnsChange', $event as string[])"
    >
      <el-checkbox
        v-for="column in dataset?.columns ?? []"
        :key="column"
        :value="column"
        :label="column"
      />
    </el-checkbox-group>
    <div class="designer-limit">
      <span>{{ t("dataReport.tableLimit") }}</span>
      <el-input-number
        :model-value="tableLimit"
        :min="REPORT_TABLE_LIMIT.min"
        :max="REPORT_TABLE_LIMIT.max"
        size="small"
        controls-position="right"
        @change="emit('limitChange', $event as number)"
      />
    </div>

    <el-divider />
    <div class="designer-side__title">{{ t("dataReport.componentShelf") }}</div>
    <div class="designer-shelf">
      <el-button
        v-for="type in REPORT_COMPONENT_TYPES"
        :key="type"
        class="w-full"
        size="small"
        :data-testid="`add-${type}`"
        @click="emit('addComponent', type)"
      >
        {{ componentLabel(type) }}
      </el-button>
    </div>
  </aside>
</template>

<style lang="scss" scoped>
.designer-side {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 8px;
  width: 240px;
  padding: 14px 12px;
  overflow: auto;
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-lighter);
}

.designer-side__title {
  margin-top: 6px;
  font-size: var(--el-font-size-base);
  font-weight: 600;
}

.designer-side__hint {
  font-size: var(--el-font-size-extra-small);
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.designer-columns {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 32vh;
  overflow: auto;
}

.designer-limit {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);

  :deep(.el-input-number) {
    width: 110px;
  }
}

.designer-shelf {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.designer-side :deep(.el-divider) {
  margin: 4px 0;
}
</style>
