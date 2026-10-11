<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
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
 * 快捷操作：全选 = 显式勾选全部列；清空 = 回到「跟随数据集全部列」
 * （明细表不可能为空表，空清单语义即全列，消息里说明避免误解）。
 */
defineOptions({ name: "ReportDesignSidebar" });

const props = defineProps<{
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

const emitSelectAll = () => {
  emit("columnsChange", [...(props.dataset?.columns ?? [])]);
};

const emitClear = () => {
  emit("columnsChange", []);
  message(t("dataReport.columnsResetHint"), { type: "info" });
};
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

    <div class="designer-side__title-row">
      <div class="designer-side__title">{{ t("dataReport.designDetail") }}</div>
      <div class="designer-side__quick">
        <el-button link type="primary" size="small" @click="emitSelectAll">
          {{ t("dataReport.selectAllColumns") }}
        </el-button>
        <el-button link type="primary" size="small" @click="emitClear">
          {{ t("dataReport.clearColumns") }}
        </el-button>
      </div>
    </div>
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
  gap: var(--space-2);
  width: 240px;
  padding: var(--space-3);
  overflow: auto;
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-lighter);
}

.designer-side__title-row {
  display: flex;
  gap: 4px;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--space-1);
}

.designer-side__title {
  font-size: var(--el-font-size-base);
  font-weight: 600;
}

.designer-side__quick {
  display: flex;
  gap: 0;
}

.designer-side__hint {
  font-size: var(--el-font-size-extra-small);
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.designer-columns {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
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
  gap: var(--space-2);

  /* EP 的 `.el-button + .el-button { margin-left: 12px }` 是横向按钮组语义，
     纵向列布局里会把第 2 个起的按钮整体顶右 12px，必须清零（宽度由 w-full 决定） */
  :deep(.el-button + .el-button) {
    margin-left: 0;
  }
}

.designer-side :deep(.el-divider) {
  margin: var(--space-1) 0;
}
</style>
