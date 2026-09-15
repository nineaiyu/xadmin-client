<script lang="ts" setup>
import { computed, reactive } from "vue";
import { useI18n } from "vue-i18n";
import { choiceValue } from "@/utils/dict";
import { message } from "@/utils/message";
import type { DatasetItem } from "@/api/system/datasets";
import type { ReportItem } from "@/api/system/analysis";

/**
 * 定时报表表单（C5：弹窗体系收敛到 ReDialog 的 content 组件形态）。
 *
 * 组件负责「表单数据 + 数据集联动 + 载荷生成」，提交与列表刷新由页面在
 * `beforeSure` 中处理；校验失败返回 null，调用方保持弹窗打开。
 */
defineOptions({ name: "AnalysisReportForm" });

const props = defineProps<{
  /** 编辑时的原始行（null / 缺省 = 新建） */
  row?: ReportItem | null;
  /** 可选数据集（由页面加载后传入，驱动分组字段选项） */
  datasets: DatasetItem[];
}>();

const { t } = useI18n();

const form = reactive({
  name: props.row?.name ?? "",
  dataset: props.row?.dataset ?? "",
  // mode/frequency 带 choices，接口下发 {value,label} 对象；不归一化会让 radio 警告，
  // 且 mode 判断失效会把聚合报表的 date_trunc 误清空
  mode: (props.row ? choiceValue(props.row.mode) : "rows") as
    "rows" | "aggregate",
  group_by: props.row?.group_by ?? "",
  metric: (props.row?.metric as "count" | "sum" | "avg") ?? "count",
  date_trunc: props.row?.date_trunc ?? "day",
  value_field: props.row?.value_field ?? "",
  frequency: (props.row ? choiceValue(props.row.frequency) : "daily") as
    "daily" | "weekly" | "monthly",
  send_time: props.row?.send_time ?? "08:00",
  weekday: props.row?.weekday ?? 0,
  // cron 表达式（ADR-041）：非空时优先于上面三档频次
  cron_expression: props.row?.cron_expression ?? "",
  recipients: (props.row?.recipients ?? []).join(", "),
  is_active: props.row?.is_active ?? true
});

/** 当前数据集（驱动分组字段候选） */
const selectedDataset = computed(
  () => props.datasets.find(item => item.pk === form.dataset) ?? null
);

/** 数据集切换联动：分组字段重置为该数据集首列 */
const onDatasetPicked = () => {
  form.group_by = selectedDataset.value?.columns[0] ?? "";
};

/** 校验并生成提交载荷；校验失败返回 null（调用方保持弹窗打开） */
const getPayload = (): Record<string, unknown> | null => {
  if (!form.name || !form.dataset) {
    message(t("dataReport.required"), { type: "warning" });
    return null;
  }
  const recipients = form.recipients.split(/[,;\s]+/).filter(Boolean);
  return {
    name: form.name,
    dataset: form.dataset,
    mode: form.mode,
    group_by: form.group_by,
    metric: form.metric,
    date_trunc: form.mode === "aggregate" ? form.date_trunc : "",
    value_field: form.value_field,
    frequency: form.frequency,
    send_time: form.send_time,
    weekday: Number(form.weekday),
    cron_expression: form.cron_expression.trim(),
    recipients,
    is_active: form.is_active
  };
};

defineExpose({ getPayload });
</script>

<template>
  <el-form label-width="100px">
    <el-form-item :label="t('dataReport.name')" required>
      <el-input v-model="form.name" />
    </el-form-item>
    <el-form-item :label="t('dataReport.dataset')" required>
      <el-select
        v-model="form.dataset"
        class="w-full"
        filterable
        @change="onDatasetPicked"
      >
        <el-option
          v-for="item in datasets"
          :key="item.pk"
          :value="item.pk"
          :label="item.name"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('dataReport.mode')">
      <el-radio-group v-model="form.mode">
        <el-radio value="rows">{{ t("dataReport.modeRows") }}</el-radio>
        <el-radio value="aggregate">{{
          t("dataReport.modeAggregate")
        }}</el-radio>
      </el-radio-group>
    </el-form-item>
    <template v-if="form.mode === 'aggregate'">
      <el-form-item :label="t('dataReport.groupBy')">
        <el-select v-model="form.group_by" class="w-full" filterable>
          <el-option
            v-for="f in selectedDataset?.columns ?? []"
            :key="f"
            :value="f"
            :label="f"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('dataReport.metric')">
        <el-select v-model="form.metric" class="w-full">
          <el-option value="count" :label="t('dataReport.metricCount')" />
          <el-option value="sum" :label="t('dataReport.metricSum')" />
          <el-option value="avg" :label="t('dataReport.metricAvg')" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('dataReport.dateTrunc')">
        <el-select v-model="form.date_trunc" class="w-full" clearable>
          <el-option value="day" :label="t('dataReport.byDay')" />
          <el-option value="month" :label="t('dataReport.byMonth')" />
        </el-select>
      </el-form-item>
    </template>
    <el-form-item :label="t('dataReport.frequency')">
      <el-radio-group v-model="form.frequency">
        <el-radio value="daily">{{ t("dataReport.daily") }}</el-radio>
        <el-radio value="weekly">{{ t("dataReport.weekly") }}</el-radio>
        <el-radio value="monthly">{{ t("dataReport.monthly") }}</el-radio>
      </el-radio-group>
    </el-form-item>
    <el-form-item :label="t('dataReport.sendTime')">
      <el-input v-model="form.send_time" class="w-32!" placeholder="08:00" />
      <el-select
        v-if="form.frequency === 'weekly'"
        v-model="form.weekday"
        class="ml-2 w-32"
      >
        <el-option
          v-for="(label, index) in [
            '周一',
            '周二',
            '周三',
            '周四',
            '周五',
            '周六',
            '周日'
          ]"
          :key="index"
          :value="index"
          :label="label"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('dataReport.cronExpression')">
      <el-input
        v-model="form.cron_expression"
        class="w-64!"
        placeholder="0 9 * * 1-5"
      />
      <span class="ml-2 text-xs text-gray-400">
        {{ t("dataReport.cronHint") }}
      </span>
    </el-form-item>
    <el-form-item :label="t('dataReport.recipients')" required>
      <el-input
        v-model="form.recipients"
        :placeholder="t('dataReport.recipientsHint')"
      />
    </el-form-item>
    <el-form-item :label="t('dataReport.isActive')">
      <el-switch v-model="form.is_active" />
    </el-form-item>
  </el-form>
</template>
