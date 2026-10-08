<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import { datasetApi, type ExecuteResult } from "@/api/dataset/datasets";
import { message } from "@/utils/message";

/**
 * 明细表预览：按设计列（`designColumns`）展示数据集前 N 行。
 *
 * 数据源复用数据集执行接口（服务端已按字段权限裁剪输出列，fail-closed），
 * 因此「设计列 ∩ 返回列」才是真正可渲染的列——面板里选了但无权限的列会被静默跳过，
 * 与投递侧 xlsx 的列裁剪口径一致（`design_export_columns`）。
 */
defineOptions({ name: "ReportTablePreview" });

const props = defineProps<{
  datasetPk: string;
  /** 设计列（空 = 全部列） */
  columns: string[];
  /** 明细行数上限 */
  limit: number;
}>();

const { t } = useI18n();

const rows = ref<Record<string, unknown>[]>([]);
const available = ref<string[]>([]);
const total = ref(0);
const loading = ref(false);
const errorMsg = ref("");

/** 可渲染列 = 设计列 ∩ 服务端返回列（保设计顺序） */
const visibleColumns = computed(() =>
  props.columns.length
    ? props.columns.filter(column => available.value.includes(column))
    : available.value
);

/**
 * 单元格取值：显式按键取（`row[column]`），不用 el-table 的 prop 解析。
 * 列名可能是 JSON 路径声明（`data.kind` / `data.amount|number`），EP 的 prop
 * 会按 `.` 拆路径，与其它渲染点（数据集预览 / AI 结果表）口径也不一致。
 */
const cellText = (row: Record<string, unknown>, column: string) => {
  const value = row[column];
  if (value === null || value === undefined || value === "") return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
};

const load = async () => {
  if (!props.datasetPk) return;
  loading.value = true;
  errorMsg.value = "";
  try {
    const res = await datasetApi.execute<ExecuteResult>(props.datasetPk);
    if (res.code !== SUCCESS_CODE) {
      errorMsg.value = String(res.detail ?? t("dataReport.tableLoadFailed"));
      return;
    }
    const result = res.data;
    available.value = result?.columns ?? [];
    rows.value = (result?.rows ?? []).slice(0, props.limit);
    total.value = result?.total ?? rows.value.length;
  } catch (error) {
    errorMsg.value = String(
      (error as { detail?: string })?.detail ?? t("dataReport.tableLoadFailed")
    );
  } finally {
    loading.value = false;
  }
};

onMounted(load);
// 设计列/行数上限变化只影响展示裁剪，无需重拉；仅数据集切换时重拉
watch(() => props.datasetPk, load);

const notifyFull = () => {
  if (total.value > rows.value.length) {
    message(
      t("dataReport.tableTruncated", {
        shown: rows.value.length,
        total: total.value
      }),
      {
        type: "info"
      }
    );
  }
};

defineExpose({ load, notifyFull });
</script>

<template>
  <div class="report-table" data-testid="report-table">
    <div class="report-table__head">
      <span class="report-table__title">{{ t("dataReport.detailTable") }}</span>
      <span class="report-table__meta">
        {{
          t("dataReport.tableRows", {
            shown: rows.length,
            total
          })
        }}
      </span>
    </div>
    <p v-if="errorMsg" class="report-table__error">{{ errorMsg }}</p>
    <el-table
      v-else
      v-loading="loading"
      :data="rows"
      size="small"
      height="240"
      border
    >
      <el-table-column
        v-for="column in visibleColumns"
        :key="column"
        :label="column"
        min-width="120"
        show-overflow-tooltip
      >
        <template #default="{ row }">{{ cellText(row, column) }}</template>
      </el-table-column>
      <el-table-column v-if="visibleColumns.length === 0" label="—" />
    </el-table>
  </div>
</template>

<style lang="scss" scoped>
.report-table__head {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 8px;
}

.report-table__title {
  font-size: var(--el-font-size-base);
  font-weight: 600;
}

.report-table__meta,
.report-table__error {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}

.report-table__error {
  padding: 24px 0;
  color: var(--el-color-danger);
  text-align: center;
}
</style>
