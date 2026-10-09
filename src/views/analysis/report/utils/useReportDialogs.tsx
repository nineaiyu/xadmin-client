import { h, ref } from "vue";
import type { Ref } from "vue";
import { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
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
        ).catch(normalizeError);
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

  return { openDialog };
}
