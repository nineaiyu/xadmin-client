<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";

/**
 * 通用执行结果表：NL 查询结果（columns/rows 或 series）与读类动作结果
 * （分页 results）共用同一渲染，避免每种动作各写一套表格。
 *
 * 行数截断展示（最多 20 行）+ 总数提示：完整数据以导出/业务页面为准，
 * 对话流里的结果以"可读概览"为目标。
 */
const props = defineProps<{ data: Record<string, unknown> }>();

const { t } = useI18n();

const ROWS_LIMIT = 20;
const COLUMNS_LIMIT = 8;

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      item => item && typeof item === "object" && !Array.isArray(item)
    )
  );
}

const table = computed(() => {
  const data = props.data;
  if (Array.isArray(data.columns) && isRecordArray(data.rows)) {
    const columns = (data.columns as string[]).slice(0, COLUMNS_LIMIT);
    const rows = (data.rows as Record<string, unknown>[]).slice(0, ROWS_LIMIT);
    return { columns, rows, total: Number(data.total ?? rows.length) };
  }
  if (Array.isArray(data.series)) {
    const series = (data.series as { name: unknown; value: unknown }[]).slice(
      0,
      ROWS_LIMIT
    );
    return {
      columns: ["name", "value"],
      rows: series.map(item => ({
        name: String(item.name ?? ""),
        value: String(item.value ?? "")
      })),
      total: Number(data.total ?? series.length)
    };
  }
  if (isRecordArray(data.results)) {
    const rows = (data.results as Record<string, unknown>[]).slice(
      0,
      ROWS_LIMIT
    );
    const columns = rows.length
      ? Object.keys(rows[0])
          .filter(key => key !== "pk")
          .slice(0, COLUMNS_LIMIT)
      : [];
    return { columns, rows, total: Number(data.total ?? rows.length) };
  }
  return keyValueTable(data);
});

/**
 * 键值兜底：任意只读动作的返回多为「指标名 → 值」对象（monitor.overview、
 * file.stats、dashboard 的 metrics 等），摊平成两列键值表保证有数据可看；
 * 非 JSON 原始结构（嵌套数组、分页对象等）不强行造表。
 */
function keyValueTable(data: Record<string, unknown>): {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
} | null {
  const source =
    data.metrics &&
    typeof data.metrics === "object" &&
    !Array.isArray(data.metrics)
      ? (data.metrics as Record<string, unknown>)
      : data;
  const entries = Object.entries(source).filter(
    ([key]) => key !== "columns" && key !== "rows"
  );
  if (!entries.length || entries.length > 12) return null;
  return {
    columns: [t("ai.resultName"), t("ai.resultValue")],
    rows: entries.map(([key, value]) => ({
      name: key,
      value:
        value === null || value === undefined
          ? ""
          : typeof value === "object"
            ? JSON.stringify(value)
            : String(value)
    })),
    total: entries.length
  };
}

function valueOf(row: Record<string, unknown>, column: string) {
  const value = row[column];
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
</script>

<template>
  <div
    v-if="table"
    class="mt-1 w-full overflow-hidden rounded border border-solid border-(--el-border-color-lighter)"
    data-testid="ai-result-table"
  >
    <div
      class="bg-(--el-fill-color-lighter) px-2 py-1 text-xs text-(--el-text-color-secondary)"
    >
      {{ t("ai.resultRows", { count: table.total, shown: table.rows.length }) }}
    </div>
    <el-table :data="table.rows" max-height="280" size="small">
      <el-table-column
        v-for="col in table.columns"
        :key="col"
        :prop="col"
        :label="col"
        min-width="110"
        show-overflow-tooltip
      >
        <template #default="{ row }">{{ valueOf(row, col) }}</template>
      </el-table-column>
    </el-table>
  </div>
</template>
