<script lang="ts" setup>
/**
 * 卡片下钻明细抽屉：展示卡片数据集的明细行，支持按点击的维度值过滤。
 * 数据走 execute 的请求级 filters（与数据集定义 filters 叠加，同口径校验）；
 * 过滤依据是聚合序列的 raw 原始值（name 经字段元数据映射，不可直接过滤）。
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import ReEmpty from "@/components/ReEmpty";
import DataTable from "@/components/DataTable";
import { isSuccess } from "@/api/types";
import { datasetApi, type ExecuteResult } from "@/api/dataset/datasets";
import { formatPreviewCell } from "../dataset/utils/csv";

defineOptions({ name: "DashboardCardDrillDrawer" });

const props = defineProps<{
  /** v-model 显隐 */
  modelValue: boolean;
  /** 抽屉标题（卡片标题） */
  title: string;
  /** 数据集主键 */
  dataset: string;
  /** 维度过滤：field = 分组字段、label = 可读维度值、value = raw 原始值 */
  filter: { field: string; label: string; value: unknown } | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [val: boolean];
}>();

const { t } = useI18n();
const loading = ref(false);
const failed = ref("");
const result = ref<ExecuteResult | null>(null);
const filtered = ref(false);

const visible = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit("update:modelValue", val)
});

async function load(useFilter: boolean) {
  loading.value = true;
  failed.value = "";
  try {
    const payload =
      useFilter && props.filter
        ? {
            filters: [
              {
                field: props.filter.field,
                op: "exact",
                value: props.filter.value
              }
            ]
          }
        : {};
    const res = await datasetApi
      .execute<ExecuteResult>(props.dataset, payload)
      .catch(() => null);
    if (res && isSuccess(res) && res.data) {
      result.value = res.data;
    } else {
      failed.value = res?.detail ?? t("dashboard.drillLoadFailed");
      result.value = null;
    }
  } finally {
    loading.value = false;
  }
}

/** 打开时拉取（沿用当前过滤态）；过滤被移除后重拉全量 */
watch(
  () => [props.modelValue, props.dataset] as const,
  ([open]) => {
    if (open) {
      filtered.value = Boolean(props.filter);
      void load(filtered.value);
    }
  }
);

function clearFilter() {
  filtered.value = false;
  void load(false);
}

function reload() {
  void load(filtered.value);
}
</script>

<template>
  <el-drawer
    v-model="visible"
    :title="title"
    size="60%"
    append-to-body
    destroy-on-close
  >
    <div data-testid="card-drill-drawer">
      <el-alert
        v-if="filter && filtered"
        type="info"
        :closable="false"
        class="mb-2"
      >
        <template #title>
          <span data-testid="card-drill-filter">
            {{
              t("dashboard.drillFilteredBy", {
                field: filter.field,
                value: filter.label
              })
            }}
          </span>
          <el-button link type="primary" class="ml-2" @click="clearFilter">
            {{ t("dashboard.drillClearFilter") }}
          </el-button>
        </template>
      </el-alert>
      <ReEmpty v-if="failed" :description="failed" icon="ep/warning">
        <el-button type="primary" @click="reload">
          {{ t("dashboard.drillRetry") }}
        </el-button>
      </ReEmpty>
      <div v-else v-loading="loading">
        <DataTable
          :data="result?.rows ?? []"
          max-height="calc(100vh - 220px)"
          :label="t('dashboard.drillRows')"
        >
          <el-table-column
            v-for="col in result?.columns ?? []"
            :key="col"
            :prop="col"
            :label="col"
            min-width="120"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ formatPreviewCell(row[col]) }}
            </template>
          </el-table-column>
        </DataTable>
        <div class="mt-2 text-xs text-(--el-text-color-secondary)">
          {{
            t("dashboard.drillTotal", {
              count: result?.total ?? 0,
              limit: result?.limit ?? 0
            })
          }}
        </div>
      </div>
    </div>
  </el-drawer>
</template>
