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

/** 当前数据集列（切换数据集后候选更新） */
const datasetColumns = computed(
  () => props.datasets.find(item => item.pk === form.dataset)?.columns ?? []
);

const onDatasetPicked = () => {
  form.group_by = datasetColumns.value[0];
  if (!form.title) {
    form.title =
      props.datasets.find(item => item.pk === form.dataset)?.name ?? "";
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
      <el-select v-model="form.chart_type" class="w-full">
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
      <el-select v-model="form.date_trunc" class="w-full">
        <el-option value="day" :label="t('dashboard.byDay')" />
        <el-option value="month" :label="t('dashboard.byMonth')" />
      </el-select>
    </el-form-item>
    <el-form-item
      v-if="form.chart_type === 'bar' || form.chart_type === 'pie'"
      :label="t('dashboard.metric')"
    >
      <el-select v-model="form.metric" class="w-full">
        <el-option value="count" :label="t('dashboard.metricCount')" />
        <el-option value="sum" :label="t('dashboard.metricSum')" />
        <el-option value="avg" :label="t('dashboard.metricAvg')" />
      </el-select>
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
