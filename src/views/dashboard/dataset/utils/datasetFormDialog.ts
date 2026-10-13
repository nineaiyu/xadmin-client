import { h, onMounted, ref } from "vue";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { isSuccess } from "@/api/types";
import { message } from "@/utils/message";
import { useDialogForm } from "@/hooks/useDialogForm";
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
    if (res && isSuccess(res)) {
      meta.value = res.data as DatasetMeta;
    } else {
      message(t("dataDataset.metaLoadFailed"), { type: "warning" });
    }
  });

  const formRef = ref<InstanceType<typeof DatasetForm>>();

  const openDialog = (row: DatasetItem | null) => {
    formRef.value = undefined;
    // 显式指定载荷泛型：ref 包装的实例类型无法从 getPayload 返回类型反推（TS 退化 unknown）
    const { beforeSure } = useDialogForm<Record<string, unknown>>({
      formRef,
      submit: payload =>
        row
          ? datasetApi.partialUpdate(row.pk, payload)
          : datasetApi.create(payload),
      successText: t("dataDataset.saveOk"),
      // 先关弹窗再刷新列表，避免刷新耗时导致弹窗滞留（useDialogForm 内 done 先于回调）
      onSuccess: () => tableRef.value?.handleGetData()
    });
    addDialog({
      title: row ? t("dataDataset.edit") : t("dataDataset.create"),
      width: dialogSize("lg"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () =>
        h(DatasetForm, { ref: formRef, row, meta: meta.value }),
      beforeSure
    });
  };

  return { meta, openDialog };
}
