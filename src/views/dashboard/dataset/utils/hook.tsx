import { reactive, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth, usePageAuth } from "@/router/utils";
import { datasetApi } from "@/api/dataset/datasets";
import { formatPreviewCell } from "./csv";
import { useDatasetColumns } from "./datasetColumns";
import { useDatasetPreview } from "./datasetPreview";
import { useDatasetFormDialog } from "./datasetFormDialog";
import { useDatasetButtons } from "./datasetButtons";

/**
 * 数据集：CRUD + 执行预览。
 *
 * - 新建/编辑走 ReDialog + DatasetForm（模型/列/过滤三层白名单选择器），
 *   设计器元数据（模型白名单 + 字段清单）见 datasetFormDialog.ts；
 * - 删除保留框架默认入口（带二次确认）；
 * - 执行预览为只读展示弹窗（C5 既定保留手写），状态与 CSV 导出见 datasetPreview.ts；
 * - 列渲染（visibility 标签、引用报表计数跳转）见 datasetColumns.tsx，
 *   按钮见 datasetButtons.ts。
 */
export function useDataset(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(datasetApi);
  const auth = usePageAuth("DataDataset");
  auth.create = false;
  auth.update = false;
  auth.partialUpdate = false;
  const flags = {
    canCreate: hasAuth("create:DataDataset"),
    canEdit: hasAuth("partialUpdate:DataDataset"),
    canExecute: hasAuth("execute:DataDataset")
  };

  const { listColumnsFormat } = useDatasetColumns({ t });
  const preview = useDatasetPreview({ t });
  const { openDialog } = useDatasetFormDialog({ t, tableRef });
  const { operationButtonsProps, tableBarButtonsProps } = useDatasetButtons({
    t,
    flags,
    actions: { openPreview: preview.openPreview, openDialog }
  });

  return {
    api,
    auth,
    listColumnsFormat,
    operationButtonsProps,
    tableBarButtonsProps,
    previewDialog: preview.previewDialog,
    preview: preview.preview,
    exportPreviewCsv: preview.exportPreviewCsv,
    formatPreviewCell,
    previewMode: preview.previewMode,
    aggregateForm: preview.aggregateForm,
    aggregateResult: preview.aggregateResult,
    aggregateLoading: preview.aggregateLoading,
    aggregateNumericColumns: preview.aggregateNumericColumns,
    needsAggregateValue: preview.needsAggregateValue,
    onAggregateMetricChange: preview.onAggregateMetricChange,
    runAggregatePreview: preview.runAggregatePreview,
    exportAggregateCsv: preview.exportAggregateCsv
  };
}
