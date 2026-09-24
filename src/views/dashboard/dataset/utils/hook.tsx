import { SUCCESS_CODE } from "@/api/types";
import { h, onMounted, reactive, ref, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElLink, ElTag } from "element-plus";
import { useRouter } from "vue-router";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { formatDateTime } from "@/utils";
import { message } from "@/utils/message";
import { choiceValue, statusTagProps, type StatusTagType } from "@/utils/dict";
import type { OperationProps, PageTableColumn } from "@/components/RePlusPage";
import {
  datasetApi,
  type DatasetItem,
  type DatasetMeta
} from "@/api/system/datasets";
import DatasetForm from "../components/DatasetForm.vue";

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
  const auth = reactive({
    ...getDefaultAuths("DataDataset"),
    create: false,
    update: false,
    partialUpdate: false
  });
  const canCreate = hasAuth("create:DataDataset");
  const canEdit = hasAuth("partialUpdate:DataDataset");
  const canExecute = hasAuth("execute:DataDataset");

  /** 设计器元数据（模型白名单 + 字段清单）：编辑弹窗与列格式共用 */
  const meta = ref<DatasetMeta>({ models: [], fields: {} });
  onMounted(async () => {
    const res = await datasetApi.meta();
    if (res.code === SUCCESS_CODE) {
      meta.value = res.data as unknown as DatasetMeta;
    }
  });

  const visibilityLabel = (value: string) =>
    value === "shared" ? t("dataDataset.shared") : t("dataDataset.personal");

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "visibility":
          column["cellRenderer"] = ({ row }) => {
            const raw = (row as DatasetItem).visibility;
            const value = choiceValue(raw);
            return h(
              ElTag,
              { size: "small", ...statusTagProps(raw, VISIBILITY_TAG) },
              () => visibilityLabel(value)
            );
          };
          break;
        case "bound_model":
          column["minWidth"] = 160;
          break;
        case "description":
          column["minWidth"] = 180;
          break;
        case "report_count":
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
          break;
      }
    });
    return columns;
  };

  /* ---------------- 执行预览（只读展示弹窗，C5 既定保留手写） ---------------- */
  const previewDialog = ref(false);
  const preview = ref<{
    columns: string[];
    rows: Record<string, unknown>[];
    total: number;
  } | null>(null);

  const openPreview = async (row: DatasetItem) => {
    const res = await datasetApi.execute(row.pk);
    if (res.code === SUCCESS_CODE) {
      preview.value = res.data as never;
      previewDialog.value = true;
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  };

  /**
   * 预览单元格展示口径（表格与 CSV 导出共用，保证"所见即所得"）：
   *
   * - 行数据来自后端 `values()`，JSON 字段是对象、时间字段是 ISO 原文，
   *   直接进表格会渲染成 `[object Object]` 与 `2026-09-22T13:07:31.030781Z`；
   * - 对象/数组序列化为 JSON；ISO 8601 时间转本地可读格式（微秒先截到毫秒再解析）。
   */
  const formatPreviewCell = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return formatDateTime(value);
  };

  /** 预览结果导出 CSV（前端生成，字段权限已在执行侧收敛，导出的即所见行） */
  const exportPreviewCsv = () => {
    if (!preview.value) return;
    const { columns, rows } = preview.value;
    const escape = (value: unknown) => {
      const text = formatPreviewCell(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const lines = [
      columns.map(escape).join(","),
      ...rows.map(row => columns.map(col => escape(row[col])).join(","))
    ];
    // BOM 头保证 Excel 打开中文不乱码
    const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], {
      type: "text/csv;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dataset-preview-${Date.now()}.csv`;
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
        ).catch(error => ({
          code: -1,
          detail: String((error as { detail?: string })?.detail ?? error)
        }));
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
        onClick: ({ row }) => openPreview(row as DatasetItem),
        show: canExecute && 10
      },
      {
        text: t("dataDataset.edit"),
        code: "edit",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openDialog(row as DatasetItem),
        show: canEdit && 20
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
    formatPreviewCell
  };
}
