import { SUCCESS_CODE } from "@/api/types";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { onMounted, reactive, ref, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { hasAuth, usePageAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { reportApi, runReport, type ReportItem } from "@/api/dataset/analysis";
import { datasetApi, listRows, type DatasetItem } from "@/api/dataset/datasets";
import { normalizeError } from "@/utils/apiError";
import { useReportColumns } from "./useReportColumns";
import { useReportDialogs } from "./useReportDialogs";
import { useReportButtons } from "./useReportButtons";

/**
 * 定时报表：CRUD + 立即运行。
 *
 * - 新建/编辑走 ReDialog + ReportForm（见 useReportDialogs）；
 * - 删除保留框架默认入口；立即运行为行内按钮（派发后刷新，状态列联动）；
 * - 列渲染见 useReportColumns、按钮装配见 useReportButtons（行数门禁拆分）。
 */
export function useReport(tableRef: Ref) {
  const { t } = useI18n();
  const router = useRouter();
  const api = reactive(reportApi);
  const auth = usePageAuth("DataReport");
  auth.create = false;
  auth.update = false;
  auth.partialUpdate = false;
  const canCreate = hasAuth("create:DataReport");
  const canEdit = hasAuth("partialUpdate:DataReport");
  const canRun = hasAuth("run:DataReport");

  /** 数据集清单：列名映射 + 表单下拉共用 */
  const datasets = ref<DatasetItem[]>([]);
  onMounted(async () => {
    // 数据集下拉失败不阻塞报表主链路：显式提示（此前未捕获，失败用户无感知）
    const res = await fetchAllRows(datasetApi.list).catch(() => null);
    if (!res) {
      message(t("dataReport.datasetsLoadFailed"), { type: "warning" });
      return;
    }
    datasets.value = listRows<DatasetItem>(res as never);
  });

  // 联动：数据集列表「报表数」跳转携带 ?dataset=<pk> —— 由 RePlusPage 的
  // routeParams 装配（route.query → 搜索默认值）自动生效，页面无需再注入。

  const { listColumnsFormat } = useReportColumns({ datasets });
  const { openDialog } = useReportDialogs({ datasets, tableRef });

  const run = async (row: ReportItem, loading?: { value: boolean }) => {
    if (loading) loading.value = true;
    const res = await runReport(row.pk).catch(normalizeError);
    if (loading) loading.value = false;
    if (res.code === SUCCESS_CODE) {
      message(t("dataReport.runOk"), { type: "success" });
      tableRef.value?.handleGetData();
      return;
    }
    if (res.detail) message(String(res.detail), { type: "warning" });
  };

  /** 报表设计器：新开独立页（保存走 partialUpdate，需编辑权限） */
  const design = (row: ReportItem) => {
    router.push({ path: "/analysis/report/designer", query: { pk: row.pk } });
  };

  const { operationButtonsProps, tableBarButtonsProps } = useReportButtons({
    canCreate,
    canEdit,
    canRun,
    run,
    design,
    openDialog
  });

  return {
    api,
    auth,
    listColumnsFormat,
    operationButtonsProps,
    tableBarButtonsProps
  };
}
