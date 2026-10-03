<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type {
  ReportComponentType,
  ReportDesignComponent
} from "@/api/dataset/analysis";
import type { DatasetItem } from "@/api/dataset/datasets";
import { REPORT_SPANS } from "../utils/design";

/**
 * 聚合组件属性面板（报表设计器右侧）。
 *
 * 只改数据：分组/指标/数值字段的可选范围来自数据集定义（数值列取 `numeric_columns`），
 * 与投递侧校验同源；非法组合（图表缺分组、sum 取非数值列）在服务端会被 400 拦截，
 * 这里通过必填与选项收敛在源头避免。
 */
defineOptions({ name: "ReportComponentForm" });

const props = defineProps<{
  component: ReportDesignComponent;
  dataset: DatasetItem | null;
  /** 选中组件是否位于列表首位/末位（决定上移/下移可用性） */
  first?: boolean;
  last?: boolean;
}>();

const emit = defineEmits<{
  update: [patch: Partial<ReportDesignComponent>];
  remove: [id: string];
  moveUp: [];
  moveDown: [];
  duplicate: [];
}>();

const { t } = useI18n();

const columns = computed(() => props.dataset?.columns ?? []);
const numericColumns = computed(() => props.dataset?.numeric_columns ?? []);
const isNumber = computed(() => props.component.type === "number");
const needsValue = computed(
  () => (props.component.metric ?? "count") !== "count"
);

const typeLabel = computed(() => {
  const map: Record<ReportComponentType, string> = {
    number: t("dataReport.componentNumber"),
    bar: t("dataReport.componentBar"),
    line: t("dataReport.componentLine"),
    pie: t("dataReport.componentPie")
  };
  return map[props.component.type];
});

/** 切换指标时同步清理/补齐数值字段（count 不需要取值列，sum/avg 必须为数值列） */
const onMetricChange = (metric: "count" | "sum" | "avg") => {
  if (metric === "count") {
    emit("update", { metric, value_field: "" });
    return;
  }
  const current = props.component.value_field ?? "";
  emit("update", {
    metric,
    value_field: numericColumns.value.includes(current)
      ? current
      : (numericColumns.value[0] ?? "")
  });
};
</script>

<template>
  <div class="component-form">
    <div class="component-form__head">
      <span>{{ t("dataReport.componentProps") }}</span>
      <span class="component-form__type">{{ typeLabel }}</span>
    </div>

    <div class="component-form__toolbar">
      <el-tooltip :content="t('dataReport.moveUp')" placement="top">
        <el-button
          size="small"
          :disabled="props.first"
          data-testid="component-move-up"
          @click="emit('moveUp')"
        >
          ↑
        </el-button>
      </el-tooltip>
      <el-tooltip :content="t('dataReport.moveDown')" placement="top">
        <el-button
          size="small"
          :disabled="props.last"
          data-testid="component-move-down"
          @click="emit('moveDown')"
        >
          ↓
        </el-button>
      </el-tooltip>
      <el-button
        size="small"
        class="flex-1"
        data-testid="component-duplicate"
        @click="emit('duplicate')"
      >
        {{ t("dataReport.duplicateComponent") }}
      </el-button>
    </div>

    <el-form label-width="72px" label-position="left" size="small">
      <el-form-item :label="t('dataReport.componentTitle')">
        <el-input
          :model-value="component.title ?? ''"
          data-testid="component-title"
          :placeholder="typeLabel"
          @update:model-value="emit('update', { title: $event })"
        />
      </el-form-item>

      <el-form-item :label="t('dataReport.componentWidth')">
        <el-radio-group
          :model-value="component.span ?? REPORT_SPANS[0]"
          @change="emit('update', { span: $event as 12 })"
        >
          <el-radio-button :value="12">
            {{ t("dataReport.widthFull") }}
          </el-radio-button>
          <el-radio-button :value="6">
            {{ t("dataReport.widthHalf") }}
          </el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item v-if="!isNumber" :label="t('dataReport.groupBy')" required>
        <el-select
          :model-value="component.group_by ?? ''"
          class="w-full"
          filterable
          @change="emit('update', { group_by: $event })"
        >
          <el-option
            v-for="column in columns"
            :key="column"
            :value="column"
            :label="column"
          />
        </el-select>
      </el-form-item>

      <el-form-item :label="t('dataReport.metric')">
        <el-select
          :model-value="component.metric ?? 'count'"
          class="w-full"
          @change="onMetricChange($event)"
        >
          <el-option value="count" :label="t('dataReport.metricCount')" />
          <el-option value="sum" :label="t('dataReport.metricSum')" />
          <el-option value="avg" :label="t('dataReport.metricAvg')" />
        </el-select>
      </el-form-item>

      <el-form-item
        v-if="needsValue"
        :label="t('dataReport.valueField')"
        required
      >
        <el-select
          :model-value="component.value_field ?? ''"
          class="w-full"
          filterable
          @change="emit('update', { value_field: $event })"
        >
          <el-option
            v-for="column in numericColumns"
            :key="column"
            :value="column"
            :label="column"
          />
        </el-select>
      </el-form-item>

      <el-form-item v-if="!isNumber" :label="t('dataReport.dateTrunc')">
        <el-select
          :model-value="component.date_trunc ?? ''"
          class="w-full"
          @change="emit('update', { date_trunc: $event || undefined })"
        >
          <el-option value="" :label="t('dataReport.truncNone')" />
          <el-option value="day" :label="t('dataReport.truncDay')" />
          <el-option value="month" :label="t('dataReport.truncMonth')" />
        </el-select>
      </el-form-item>

      <el-button
        class="w-full"
        type="danger"
        plain
        size="small"
        data-testid="component-remove"
        @click="emit('remove', component.id)"
      >
        {{ t("dataReport.removeComponent") }}
      </el-button>
    </el-form>
  </div>
</template>

<style lang="scss" scoped>
.component-form__head {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  font-size: var(--el-font-size-base);
  font-weight: 600;
}

.component-form__toolbar {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 10px;

  /* 清零 EP 横向按钮组的同级左边距，避免工具条间距叠加错位 */
  :deep(.el-button + .el-button) {
    margin-left: 0;
  }
}

.component-form__type {
  padding: 1px 6px;
  font-size: var(--el-font-size-extra-small);
  font-weight: 400;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-radius: 999px;
}
</style>
