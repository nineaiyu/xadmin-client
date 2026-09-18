<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { roleApi } from "@/api/system/role";
import {
  listRows,
  type DashboardCard,
  type DatasetItem
} from "@/api/system/datasets";
import { message } from "@/utils/message";

/**
 * 仪表盘卡片表单（C5：弹窗体系收敛到 ReDialog 的 content 组件形态）。
 *
 * 卡片是内存草稿（随「保存布局」统一提交），组件只负责表单数据与校验，
 * 草稿的增/改由页面在 `beforeSure` 中处理。
 */
defineOptions({ name: "DashboardCardForm" });

const props = defineProps<{
  /** 卡片初值（新建由页面传入 newCard()，编辑传既有卡片） */
  card: DashboardCard;
  /** 可选数据集（驱动分组字段候选） */
  datasets: DatasetItem[];
}>();

const { t } = useI18n();

/** 卡片宽度档位（12 栅格）与高度档位（px）：标准 224 与存量 h-56 渲染一致 */
const spanOptions = [3, 6, 9, 12];
const heightOptions = [160, 224, 320, 440];

const form = reactive<DashboardCard>({
  ...props.card,
  height: props.card.height ?? 224,
  allowed_roles: props.card.allowed_roles ?? []
});

/** 可见角色选项：值 = 角色 code，与 layout[].allowed_roles 同口径。
 * 无角色列表权限（如非超管创建者）时静默降级为空选项，已有授权值不受影响 */
const roleOptions = ref<{ pk: string; name: string; code: string }[]>([]);

onMounted(async () => {
  try {
    const res = await fetchAllRows(roleApi.list);
    if (res.code === SUCCESS_CODE && res.data) {
      roleOptions.value = listRows<{ pk: string; name: string; code: string }>(
        res as never
      );
    }
  } catch {
    roleOptions.value = [];
  }
});

/** 当前数据集（切换数据集后候选更新） */
const selectedDataset = computed(
  () => props.datasets.find(item => item.pk === form.dataset) ?? null
);
const datasetColumns = computed(() => selectedDataset.value?.columns ?? []);

/** sum/avg 的数值字段候选（后端聚合要求数值列且在白名单内；无元数据时回落全列） */
const numericColumns = computed(() => {
  const numeric = selectedDataset.value?.numeric_columns ?? [];
  return numeric.length ? numeric : datasetColumns.value;
});

const needsValueField = computed(
  () => form.metric === "sum" || form.metric === "avg"
);

const onDatasetPicked = () => {
  // 折线（趋势）优先用数据集的「时间字段」作为分组字段，否则退回首列
  const dateField = selectedDataset.value?.config?.date_field;
  form.group_by =
    form.chart_type === "line" && dateField
      ? dateField
      : datasetColumns.value[0];
  form.value_field = "";
  if (form.metric === "sum" || form.metric === "avg") {
    form.value_field = numericColumns.value[0];
  }
  if (!form.title) {
    form.title = selectedDataset.value?.name ?? "";
  }
};

/** 指标切换联动：sum/avg 需要数值字段（缺省自动带上首个数值列） */
const onMetricChanged = () => {
  if (needsValueField.value && !form.value_field) {
    form.value_field = numericColumns.value[0];
  }
  if (!needsValueField.value) {
    form.value_field = "";
  }
};

/** 图表类型切换：折线默认分组到时间字段（趋势语义），其余首列 */
const onChartTypeChanged = () => {
  if (form.chart_type === "line") {
    const dateField = selectedDataset.value?.config?.date_field;
    if (dateField) form.group_by = dateField;
  }
};

/** 校验并返回卡片草稿；校验失败返回 null（调用方保持弹窗打开） */
const getCard = (): DashboardCard | null => {
  if (!form.dataset || !form.title) {
    message(t("dashboard.cardRequired"), { type: "warning" });
    return null;
  }
  if (form.chart_type !== "number" && !form.group_by) {
    message(t("dashboard.cardRequired"), { type: "warning" });
    return null;
  }
  if (
    form.chart_type !== "number" &&
    needsValueField.value &&
    !form.value_field
  ) {
    message(t("dashboard.valueFieldRequired"), { type: "warning" });
    return null;
  }
  return { ...form };
};

defineExpose({ getCard });
</script>

<template>
  <el-form label-width="110px">
    <el-form-item :label="t('dashboard.dataset')">
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
    <el-form-item :label="t('dashboard.cardTitle')">
      <el-input v-model="form.title" />
    </el-form-item>
    <el-form-item :label="t('dashboard.cardRoles')">
      <el-select
        v-model="form.allowed_roles"
        class="w-full"
        multiple
        collapse-tags
        filterable
        clearable
        :placeholder="t('dashboard.cardRolesPlaceholder')"
      >
        <el-option
          v-for="role in roleOptions"
          :key="role.code"
          :value="role.code"
          :label="role.name"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('dashboard.chartType')">
      <el-select
        v-model="form.chart_type"
        class="w-full"
        @change="onChartTypeChanged"
      >
        <el-option value="number" :label="t('dashboard.chartNumber')" />
        <el-option value="line" :label="t('dashboard.chartLine')" />
        <el-option value="bar" :label="t('dashboard.chartBar')" />
        <el-option value="pie" :label="t('dashboard.chartPie')" />
      </el-select>
    </el-form-item>
    <el-form-item
      v-if="form.chart_type !== 'number'"
      :label="t('dashboard.groupBy')"
    >
      <el-select v-model="form.group_by" class="w-full" filterable>
        <el-option
          v-for="field in datasetColumns"
          :key="field"
          :value="field"
          :label="field"
        />
      </el-select>
    </el-form-item>
    <el-form-item
      v-if="form.chart_type === 'line'"
      :label="t('dashboard.dateTrunc')"
    >
      <el-select v-model="form.date_trunc" class="w-full" clearable>
        <el-option value="day" :label="t('dashboard.byDay')" />
        <el-option value="month" :label="t('dashboard.byMonth')" />
      </el-select>
    </el-form-item>
    <el-form-item
      v-if="form.chart_type !== 'number'"
      :label="t('dashboard.metric')"
    >
      <el-select v-model="form.metric" class="w-full" @change="onMetricChanged">
        <el-option value="count" :label="t('dashboard.metricCount')" />
        <el-option value="sum" :label="t('dashboard.metricSum')" />
        <el-option value="avg" :label="t('dashboard.metricAvg')" />
      </el-select>
    </el-form-item>
    <el-form-item
      v-if="form.chart_type !== 'number' && needsValueField"
      :label="t('dashboard.valueField')"
    >
      <el-select v-model="form.value_field" class="w-full" filterable>
        <el-option
          v-for="field in numericColumns"
          :key="field"
          :value="field"
          :label="field"
        />
      </el-select>
      <div class="text-xs text-gray-500">
        {{ t("dashboard.valueFieldTip") }}
      </div>
    </el-form-item>
    <el-form-item :label="t('dashboard.cardSpan')">
      <el-select v-model="form.span" class="w-full">
        <el-option
          v-for="span in spanOptions"
          :key="span"
          :value="span"
          :label="`${span}/12`"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('dashboard.cardHeight')">
      <el-select v-model="form.height" class="w-full">
        <el-option
          v-for="h in heightOptions"
          :key="h"
          :value="h"
          :label="`${h}px`"
        />
      </el-select>
    </el-form-item>
  </el-form>
</template>
