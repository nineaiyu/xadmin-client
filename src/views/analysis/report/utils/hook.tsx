import { SUCCESS_CODE } from "@/api/types";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { h, onMounted, reactive, ref, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElTag } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { statusTagProps, type StatusTagType } from "@/utils/dict";
import type { OperationProps, PageTableColumn } from "@/components/RePlusPage";
import {
  reportApi,
  runReport,
  relatedPk,
  type ReportItem
} from "@/api/system/analysis";
import { datasetApi, listRows, type DatasetItem } from "@/api/system/datasets";
import ReportForm from "../components/ReportForm.vue";

/** 最近执行状态兜底配色（后端值：SUCCESS* / FAILURE / 空） */
const REPORT_STATUS_TAG: Record<string, StatusTagType> = {
  SUCCESS: "success",
  // 投递失败（任一渠道）：SUCCESS_WITH_DELIVERY_ERROR 为通用口径，
  // SUCCESS_WITH_EMAIL_ERROR 为存量行兼容
  SUCCESS_WITH_DELIVERY_ERROR: "warning",
  SUCCESS_WITH_EMAIL_ERROR: "warning",
  FAILURE: "danger"
};

/** 投递渠道取值 → i18n key（与后端 REPORT_NOTIFY_CHANNELS 对齐） */
const CHANNEL_LABEL_KEYS: Record<string, string> = {
  email: "dataReport.channelEmail",
  dingtalk: "dataReport.channelDingtalk",
  wecom: "dataReport.channelWecom",
  feishu: "dataReport.channelFeishu"
};

/** LabeledChoiceField（如 frequency）取展示文案：对象取 label，标量原样 */
const dictLabel = (raw: unknown): string => {
  if (raw && typeof raw === "object") {
    const item = raw as { value?: string; label?: string };
    return item.label ?? String(item.value ?? "");
  }
  return String(raw ?? "");
};

/**
 * 定时报表：CRUD + 立即运行。
 *
 * - 新建/编辑走 ReDialog + ReportForm（数据集下拉 / 聚合细则在表单内收敛）；
 * - 删除保留框架默认入口；立即运行为行内按钮（派发后刷新，状态列联动）；
 * - dataset 列接口下发 `{pk,label}` 关联对象（label 与 pk 同值）：取 pk 后用
 *   数据集清单映射名称展示。
 */
export function useReport(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(reportApi);
  const auth = reactive({
    ...getDefaultAuths("DataReport"),
    create: false,
    update: false,
    partialUpdate: false
  });
  const canCreate = hasAuth("create:DataReport");
  const canEdit = hasAuth("partialUpdate:DataReport");
  const canRun = hasAuth("run:DataReport");

  /** 数据集清单：列名映射 + 表单下拉共用 */
  const datasets = ref<DatasetItem[]>([]);
  onMounted(async () => {
    const res = await fetchAllRows(datasetApi.list);
    datasets.value = listRows<DatasetItem>(res as never);
  });

  // F-12 联动：数据集列表「报表数」跳转携带 ?dataset=<pk> —— 由 RePlusPage 的
  // routeParams 装配（route.query → 搜索默认值）自动生效，页面无需再注入。

  const datasetName = (value: ReportItem["dataset"]) => {
    const pk = relatedPk(value);
    return datasets.value.find(item => item.pk === pk)?.name ?? pk;
  };

  /** 投递渠道展示：空 = 仅邮件（存量兼容） */
  const channelLabels = (channels: string[] | undefined) =>
    (channels?.length ? channels : ["email"])
      .map(item =>
        CHANNEL_LABEL_KEYS[item] ? t(CHANNEL_LABEL_KEYS[item]) : item
      )
      .join(", ");

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "dataset":
          column["minWidth"] = 140;
          column["cellRenderer"] = ({ row }) =>
            h("span", datasetName((row as ReportItem).dataset));
          break;
        case "frequency":
          column["cellRenderer"] = ({ row }) =>
            h("span", dictLabel((row as ReportItem).frequency));
          break;
        case "recipients":
          column["minWidth"] = 180;
          column["cellRenderer"] = ({ row }) =>
            h("span", ((row as ReportItem).recipients || []).join(", ") || "—");
          break;
        case "notify_channels":
          column["cellRenderer"] = ({ row }) =>
            h("span", channelLabels((row as ReportItem).notify_channels));
          break;
        case "last_status":
          column["cellRenderer"] = ({ row }) => {
            const status = (row as ReportItem).last_status;
            if (!status) return h("span", "-");
            return h(
              ElTag,
              { size: "small", ...statusTagProps(status, REPORT_STATUS_TAG) },
              () => dictLabel(status)
            );
          };
          break;
      }
    });
    return columns;
  };

  const run = async (row: ReportItem, loading?: { value: boolean }) => {
    if (loading) loading.value = true;
    const res = await runReport(row.pk).catch(error => ({
      code: -1,
      detail: String((error as { detail?: string })?.detail ?? error)
    }));
    if (loading) loading.value = false;
    if (res.code === SUCCESS_CODE) {
      message(t("dataReport.runOk"), { type: "success" });
      tableRef.value?.handleGetData();
      return;
    }
    if (res.detail) message(String(res.detail), { type: "warning" });
  };

  /* ---------------- 新建 / 编辑（ReDialog + ReportForm） ---------------- */
  const formRef = ref<InstanceType<typeof ReportForm>>();

  const openDialog = (row: ReportItem | null) => {
    formRef.value = undefined;
    addDialog({
      title: row ? t("dataReport.edit") : t("dataReport.create"),
      width: dialogSize("md"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () =>
        h(ReportForm, { ref: formRef, row, datasets: datasets.value }),
      beforeSure: async (done, { closeLoading }) => {
        const payload = formRef.value?.getPayload();
        if (!payload) {
          closeLoading();
          return;
        }
        // 异常归一为可读失败结果：避免请求异常时 beforeSure 抛错、弹窗 loading 悬挂
        const res = await (
          row
            ? reportApi.partialUpdate(row.pk, payload)
            : reportApi.create(payload)
        ).catch(error => ({
          code: -1,
          detail: String((error as { detail?: string })?.detail ?? error)
        }));
        if (res.code === SUCCESS_CODE) {
          message(t("dataReport.saveOk"), { type: "success" });
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
        text: t("dataReport.run"),
        code: "run",
        props: { type: "success", link: true },
        onClick: ({ row, loading }) => run(row as ReportItem, loading),
        show: canRun && 10
      },
      {
        text: t("dataReport.edit"),
        code: "edit",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openDialog(row as ReportItem),
        show: canEdit && 20
      }
    ]
  });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("dataReport.create"),
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
    tableBarButtonsProps
  };
}
