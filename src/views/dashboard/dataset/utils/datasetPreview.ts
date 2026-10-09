import { computed, reactive, ref } from "vue";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { datasetApi, type DatasetItem } from "@/api/dataset/datasets";
import { escapeCsvCell } from "./csv";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 预览结果导出 CSV（前端生成，字段权限已在执行侧收敛，导出的即所见行） */
function downloadCsv(lines: string[], filename: string) {
  // BOM 头保证 Excel 打开中文不乱码
  const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], {
    type: "text/csv;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * 数据集执行预览（自 hook.tsx 抽出，只读展示弹窗）：行明细取数与 CSV 导出，
 * 聚合预览参数（分组/指标/数值字段/时间粒度，与看板卡片同款语义）与结果。
 */
export function useDatasetPreview({ t }: { t: TFunction }) {
  const previewDialog = ref(false);
  const previewRow = ref<DatasetItem | null>(null);
  const preview = ref<{
    columns: string[];
    rows: Record<string, unknown>[];
    total: number;
  } | null>(null);

  /** 预览模式：rows = 行明细；aggregate = 聚合序列（图表数据源同口径） */
  const previewMode = ref<"rows" | "aggregate">("rows");
  /** 聚合预览参数：分组 / 指标 / 数值字段 / 时间粒度（与看板卡片同款语义） */
  const aggregateForm = reactive({
    group_by: "",
    metric: "count" as "count" | "sum" | "avg",
    value_field: "",
    date_trunc: "" as "" | "day" | "month"
  });
  const aggregateResult = ref<{
    name: string;
    series: { name: string; value: number }[];
  } | null>(null);
  const aggregateLoading = ref(false);

  const needsAggregateValue = computed(
    () => aggregateForm.metric === "sum" || aggregateForm.metric === "avg"
  );

  /** sum/avg 数值字段候选：数据集数值列优先，无元数据回落全列 */
  const aggregateNumericColumns = computed(() => {
    const numeric = previewRow.value?.numeric_columns ?? [];
    return numeric.length ? numeric : (previewRow.value?.columns ?? []);
  });

  /** 指标切换：count 不需要取值列；sum/avg 缺省补首个数值列 */
  const onAggregateMetricChange = () => {
    if (
      needsAggregateValue.value &&
      !aggregateNumericColumns.value.includes(aggregateForm.value_field)
    ) {
      aggregateForm.value_field = aggregateNumericColumns.value[0] ?? "";
    }
    if (!needsAggregateValue.value) {
      aggregateForm.value_field = "";
    }
  };

  const runAggregatePreview = async () => {
    const row = previewRow.value;
    if (!row) return;
    aggregateLoading.value = true;
    try {
      // http 层失败已统一提示，归一为 null：清空上次结果，避免展示陈旧聚合
      const res = await datasetApi
        .aggregate(row.pk, {
          group_by: aggregateForm.group_by,
          metric: aggregateForm.metric,
          date_trunc: aggregateForm.date_trunc || undefined,
          value_field: needsAggregateValue.value
            ? aggregateForm.value_field
            : undefined
        })
        .catch(() => null);
      if (res?.code === SUCCESS_CODE) {
        aggregateResult.value = res.data as never;
      } else {
        aggregateResult.value = null;
        if (res?.detail) message(String(res.detail), { type: "warning" });
      }
    } finally {
      aggregateLoading.value = false;
    }
  };

  /** 预览取数：行内「预览」按钮经 onClick 上下文注入 loading（按钮自旋） */
  const openPreview = async (
    row: DatasetItem,
    loading?: { value: boolean }
  ) => {
    previewRow.value = row;
    previewMode.value = "rows";
    aggregateResult.value = null;
    aggregateForm.group_by = row.columns[0] ?? "";
    aggregateForm.value_field = "";
    if (loading) loading.value = true;
    try {
      // http 层失败已统一提示，归一为 null：预览弹窗不打开
      const res = await datasetApi.execute(row.pk).catch(() => null);
      if (res?.code === SUCCESS_CODE) {
        preview.value = res.data as never;
        previewDialog.value = true;
      } else if (res) {
        // 业务失败（HTTP 层失败已由拦截器提示）：显式归一提示
        message(String(res.detail || t("dataDataset.previewFailed")), {
          type: "warning"
        });
      }
    } finally {
      if (loading) loading.value = false;
    }
  };

  /** 预览结果导出 CSV（行明细：列头 + 逐行转义） */
  const exportPreviewCsv = () => {
    if (!preview.value) return;
    const { columns, rows } = preview.value;
    const lines = [
      columns.map(escapeCsvCell).join(","),
      ...rows.map(row => columns.map(col => escapeCsvCell(row[col])).join(","))
    ];
    downloadCsv(lines, `dataset-preview-${Date.now()}.csv`);
  };

  /** 聚合预览导出 CSV（序列 name/value 两列，与图表数据源一致） */
  const exportAggregateCsv = () => {
    const result = aggregateResult.value;
    if (!result) return;
    const lines = [
      [t("dataDataset.groupName"), t("dataDataset.metricValue")]
        .map(escapeCsvCell)
        .join(","),
      ...result.series.map(item =>
        [escapeCsvCell(item.name), escapeCsvCell(item.value)].join(",")
      )
    ];
    downloadCsv(lines, `dataset-aggregate-${Date.now()}.csv`);
  };

  return {
    previewDialog,
    previewRow,
    preview,
    previewMode,
    aggregateForm,
    aggregateResult,
    aggregateLoading,
    aggregateNumericColumns,
    needsAggregateValue,
    onAggregateMetricChange,
    runAggregatePreview,
    openPreview,
    exportPreviewCsv,
    exportAggregateCsv
  };
}
