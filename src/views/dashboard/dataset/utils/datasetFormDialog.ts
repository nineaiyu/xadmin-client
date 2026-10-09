import { h, onMounted, ref } from "vue";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
import {
  datasetApi,
  type DatasetItem,
  type DatasetMeta
} from "@/api/dataset/datasets";
import DatasetForm from "../components/DatasetForm.vue";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 数据集新建/编辑弹窗与设计器元数据（自 hook.tsx 抽出）。
 * 元数据拉取失败点名：此前无捕获，失败后编辑弹窗模型/字段下拉恒空，无从判断。
 */
export function useDatasetFormDialog({
  t,
  tableRef
}: {
  t: TFunction;
  tableRef: Ref;
}) {
  /** 设计器元数据（模型白名单 + 字段清单）：编辑弹窗与列格式共用 */
  const meta = ref<DatasetMeta>({ models: [], fields: {} });

  onMounted(async () => {
    const res = await datasetApi.meta().catch(() => null);
    if (res?.code === SUCCESS_CODE) {
      meta.value = res.data as DatasetMeta;
    } else {
      message(t("dataDataset.metaLoadFailed"), { type: "warning" });
    }
  });

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

  return { meta, openDialog };
}
