import { h, ref } from "vue";
import type { Ref } from "vue";
import { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { useDialogForm } from "@/hooks/useDialogForm";
import { reportApi, type ReportItem } from "@/api/dataset/analysis";
import type { DatasetItem } from "@/api/dataset/datasets";
import ReportForm from "../components/ReportForm.vue";

/**
 * 报表新建/编辑弹窗（自 hook.tsx 抽出，行数门禁）：ReDialog + ReportForm，
 * 数据集下拉与聚合细则在表单内收敛。
 */
export function useReportDialogs({
  datasets,
  tableRef
}: {
  datasets: Ref<DatasetItem[]>;
  tableRef: Ref;
}) {
  const { t } = useI18n();
  const formRef = ref<InstanceType<typeof ReportForm>>();

  const openDialog = (row: ReportItem | null) => {
    formRef.value = undefined;
    // 显式指定载荷泛型：ref 包装的实例类型无法从 getPayload 返回类型反推（TS 退化 unknown）
    const { beforeSure } = useDialogForm<Record<string, unknown>>({
      formRef,
      submit: payload =>
        row
          ? reportApi.partialUpdate(row.pk, payload)
          : reportApi.create(payload),
      successText: t("dataReport.saveOk"),
      // 先关弹窗再刷新列表，避免刷新耗时导致弹窗滞留（useDialogForm 内 done 先于回调）
      onSuccess: () => tableRef.value?.handleGetData()
    });
    addDialog({
      title: row ? t("dataReport.edit") : t("dataReport.create"),
      width: dialogSize("md"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () =>
        h(ReportForm, { ref: formRef, row, datasets: datasets.value }),
      beforeSure
    });
  };

  return { openDialog };
}
