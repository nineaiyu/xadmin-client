<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import type { DatasetItem } from "@/api/dataset/datasets";

/**
 * 指标卡窗格的属性段（自 PaneInspector 拆分，行数门禁）。
 *
 * sum/avg 取值列限定数据集数值列（与服务端校验同口径，避免保存被 400 打回）；
 * 切换数据集时取值列清空重选（列集合随数据集变化）。
 */
defineOptions({ name: "ScreenPaneMetricFields" });

const props = defineProps<{
  pane: ScreenLayoutPane;
  datasets: DatasetItem[];
}>();

const emit = defineEmits<{
  update: [patch: Partial<ScreenLayoutPane>];
}>();

const { t } = useI18n();

const metricDataset = computed(
  () => props.datasets.find(item => item.pk === props.pane.dataset) ?? null
);
const metricColumns = computed(() => metricDataset.value?.columns ?? []);
const metricNumeric = computed(() => {
  const numeric = metricDataset.value?.numeric_columns ?? [];
  return numeric.length ? numeric : metricColumns.value;
});
const metricNeedsValue = computed(
  () => (props.pane.metric ?? "count") !== "count"
);

/** 切换指标：sum/avg 需要数值列，缺省补首个数值列；count 清掉取值列 */
const onMetricChange = (metric: "count" | "sum" | "avg") => {
  if (metric === "count") {
    emit("update", { metric, value_field: undefined });
    return;
  }
  const current = props.pane.value_field ?? "";
  emit("update", {
    metric,
    value_field: metricNumeric.value.includes(current)
      ? current
      : (metricNumeric.value[0] ?? "")
  });
};

/** 切换数据集：取值列清空重选（列集合随数据集变化） */
const onMetricDatasetChange = (pk: string) => {
  emit("update", { dataset: pk, value_field: undefined });
};
</script>

<template>
  <el-form-item :label="t('dataScreen.dataset')" required>
    <el-select
      :model-value="pane.dataset"
      class="w-full"
      filterable
      data-testid="inspector-metric-dataset"
      @change="onMetricDatasetChange"
    >
      <el-option
        v-for="item in datasets"
        :key="item.pk"
        :value="item.pk"
        :label="item.name"
      />
    </el-select>
  </el-form-item>
  <el-form-item :label="t('dataReport.metric')">
    <el-select
      :model-value="pane.metric ?? 'count'"
      class="w-full"
      data-testid="inspector-metric-type"
      @change="onMetricChange($event)"
    >
      <el-option value="count" :label="t('dataReport.metricCount')" />
      <el-option value="sum" :label="t('dataReport.metricSum')" />
      <el-option value="avg" :label="t('dataReport.metricAvg')" />
    </el-select>
  </el-form-item>
  <el-form-item v-if="metricNeedsValue" :label="t('dataReport.valueField')">
    <el-select
      :model-value="pane.value_field ?? ''"
      class="w-full"
      filterable
      data-testid="inspector-metric-field"
      @change="emit('update', { value_field: $event })"
    >
      <el-option
        v-for="column in metricNumeric"
        :key="column"
        :value="column"
        :label="column"
      />
    </el-select>
  </el-form-item>
</template>
