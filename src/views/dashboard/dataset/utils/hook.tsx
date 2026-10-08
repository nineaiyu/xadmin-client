import { SUCCESS_CODE } from "@/api/types";
import {
  computed,
  h,
  onMounted,
  reactive,
  ref,
  shallowRef,
  type Ref
} from "vue";
import { useI18n } from "vue-i18n";
import { ElLink, ElTag } from "element-plus";
import { useRouter } from "vue-router";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { hasAuth, usePageAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { choiceValue, statusTagProps, type StatusTagType } from "@/utils/dict";
import type { OperationProps, PageTableColumn } from "@/components/RePlusPage";
import { formatPageColumns } from "@/components/RePlusPage";
import {
  datasetApi,
  type DatasetItem,
  type DatasetMeta
} from "@/api/dataset/datasets";
import DatasetForm from "../components/DatasetForm.vue";
import { escapeCsvCell, formatPreviewCell } from "./csv";
import { normalizeError } from "@/utils/apiError";

/** 可见性兜底配色（字典未接入时的本地映射） */
const VISIBILITY_TAG: Record<string, StatusTagType> = {
  shared: "success",
  personal: "info"
};

/**
 * 数据集：CRUD + 执行预览。
 *
 * - 新建/编辑走 ReDialog + DatasetForm（模型/列/过滤三层白名单选择器）；
 * - 删除保留框架默认入口（带二次确认）；
 * - 执行预览为只读展示弹窗（C5 既定保留手写），状态在 hook 内维护；
 * - visibility 为 LabeledChoiceField：label 优先、本地映射兜底配色。
 */
export function useDataset(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(datasetApi);
  const router = useRouter();
  const auth = usePageAuth("DataDataset");
  auth.create = false;
  auth.update = false;
  auth.partialUpdate = false;
  const canCreate = hasAuth("create:DataDataset");
  const canEdit = hasAuth("partialUpdate:DataDataset");
  const canExecute = hasAuth("execute:DataDataset");

  /** 设计器元数据（模型白名单 + 字段清单）：编辑弹窗与列格式共用 */
  const meta = ref<DatasetMeta>({ models: [], fields: {} });
  onMounted(async () => {
    // 元数据拉取失败点名（此前无捕获：失败后编辑弹窗模型/字段下拉恒空，无从判断）
    const res = await datasetApi.meta().catch(() => null);
    if (res?.code === SUCCESS_CODE) {
      meta.value = res.data as DatasetMeta;
    } else {
      message(t("dataDataset.metaLoadFailed"), { type: "warning" });
    }
  });

  const visibilityLabel = (value: string) =>
    value === "shared" ? t("dataDataset.shared") : t("dataDataset.personal");

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      visibility: column => {
        column["cellRenderer"] = ({ row }) => {
          const raw = (row as DatasetItem).visibility;
          const value = choiceValue(raw);
          return h(
            ElTag,
            { size: "small", ...statusTagProps(raw, VISIBILITY_TAG) },
            () => visibilityLabel(value)
          );
        };
      },
      bound_model: column => {
        column["minWidth"] = 160;
      },
      description: column => {
        column["minWidth"] = 180;
      },
      report_count: column => {
        // 联动：被几张定时报表引用（后端关联计数）可点击，跳转报表页按数据集筛选
        column["minWidth"] = 100;
        column["cellRenderer"] = ({ row }) =>
          h(
            ElLink,
            {
              type: "primary",
              underline: false,
              onClick: () =>
                router.push({
                  path: "/analysis/report/index",
                  query: { dataset: String(row.pk) }
                })
            },
            () => String(row.report_count ?? 0)
          );
      }
    });

  /* ---------------- 执行预览（只读展示弹窗，C5 既定保留手写） ---------------- */
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

  // 预览单元格展示口径（表格与 CSV 导出共用，保证"所见即所得"）——见 ./csv.ts

  /** 预览结果导出 CSV（前端生成，字段权限已在执行侧收敛，导出的即所见行） */
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

  const downloadCsv = (lines: string[], filename: string) => {
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
  };

  /* ---------------- 新建 / 编辑（ReDialog + DatasetForm） ---------------- */
  const formRef = ref<InstanceType<typeof DatasetForm>>();

  const openDialog = (row: DatasetItem | null) => {
    formRef.value = undefined;
    addDialog({
      title: row ? t("dataDataset.edit") : t("dataDataset.create"),
      width: dialogSize("lg"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () =>
        h(DatasetForm, { ref: formRef, row, meta: meta.value }),
      beforeSure: async (done, { closeLoading }) => {
        const payload = formRef.value?.getPayload();
        if (!payload) {
          closeLoading();
          return;
        }
        // 异常归一为可读失败结果：避免请求异常时 beforeSure 抛错、弹窗 loading 悬挂
        const res = await (
          row
            ? datasetApi.partialUpdate(row.pk, payload)
            : datasetApi.create(payload)
        ).catch(normalizeError);
        if (res.code === SUCCESS_CODE) {
          message(t("dataDataset.saveOk"), { type: "success" });
          // 先关弹窗再刷新列表，避免刷新耗时导致弹窗滞留
          done();
          tableRef.value?.handleGetData();
          return;
        }
        if (res.detail) message(String(res.detail), { type: "warning" });
        closeLoading();
      }
    });
  };

  const operationButtonsProps = shallowRef<OperationProps>({
    showNumber: 4,
    width: 240,
    buttons: [
      {
        text: t("dataDataset.preview"),
        code: "preview",
        props: { type: "success", link: true },
        // 按钮级 loading：取数期间自旋，避免"点击无反馈"
        onClick: ({ row, loading }) => openPreview(row as DatasetItem, loading),
        index: 10,
        show: canExecute
      },
      {
        text: t("dataDataset.edit"),
        code: "edit",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openDialog(row as DatasetItem),
        // 非创建者行不显示编辑（保存会被后端守卫拒绝）
        index: 20,
        show: row => canEdit && row?.is_owner !== false
      }
    ]
  });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("dataDataset.create"),
        code: "create",
        props: { type: "primary" },
        onClick: () => openDialog(null),
        show: canCreate
      }
    ]
  });

  return {
    api,
    auth,
    listColumnsFormat,
    operationButtonsProps,
    tableBarButtonsProps,
    previewDialog,
    preview,
    exportPreviewCsv,
    formatPreviewCell,
    previewMode,
    aggregateForm,
    aggregateResult,
    aggregateLoading,
    aggregateNumericColumns,
    needsAggregateValue,
    onAggregateMetricChange,
    runAggregatePreview,
    exportAggregateCsv
  };
}
