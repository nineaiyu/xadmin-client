import { h, ref, type Ref } from "vue";
import { ElMessage } from "element-plus";
import type { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { handleOperation, type OperationProps } from "@/components/RePlusPage";
import type { ApiResult } from "@/api/types";
import BatchUpdateForm from "./BatchUpdateForm.vue";

/**
 * 批量更新（F-1）通用弹窗：勾选行 → 选择字段与值 → POST {baseApi}/batch-update。
 *
 * 页面侧只需：
 * 1. `const { batchUpdateButton } = useBatchUpdate({ t, api, tableRef, fields })`；
 * 2. 把 `batchUpdateButton` 追加进 `tableBarButtonsProps.buttons`。
 *
 * 约定：字段白名单由页面声明；`_write_marker` 固定为 batchUpdate（操作日志可识别入口）。
 */
export type BatchFieldOption = {
  key: string;
  label: string;
  input_type?: "boolean" | "number" | "text";
  choices?: Array<{ value: string | number | boolean; label: string }>;
};

type BatchUpdateApi = {
  batchUpdate: (
    pks: Array<string | number>,
    fields: Record<string, unknown>,
    marker?: string
  ) => Promise<ApiResult>;
};

export function useBatchUpdate(options: {
  t: ReturnType<typeof useI18n>["t"];
  api: BatchUpdateApi;
  tableRef: Ref;
  fields: BatchFieldOption[];
}) {
  const { t, api, tableRef, fields } = options;
  const formRef = ref();

  const openBatchUpdate = () => {
    const pks = (tableRef.value?.getSelectPks?.() ?? []) as Array<
      string | number
    >;
    if (!pks.length) {
      ElMessage.warning(t("batchUpdate.selectFirst"));
      return;
    }
    addDialog({
      title: t("batchUpdate.title", { count: pks.length }),
      width: dialogSize("sm"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () => h(BatchUpdateForm, { ref: formRef, fields }),
      beforeSure: (done, { closeLoading }) => {
        const payload = formRef.value?.getFields?.();
        if (!payload) {
          ElMessage.warning(t("batchUpdate.fieldRequired"));
          closeLoading();
          return;
        }
        handleOperation({
          t,
          apiReq: api.batchUpdate(pks, payload, "batchUpdate").catch(error => ({
            code: -1,
            data: null,
            detail: String(error?.message ?? error)
          })),
          success() {
            done();
            tableRef.value?.handleGetData?.();
          },
          requestEnd: closeLoading
        });
      }
    });
  };

  const batchUpdateButton: NonNullable<OperationProps["buttons"]>[number] = {
    text: t("batchUpdate.button"),
    code: "batchUpdate",
    props: { type: "primary", plain: true },
    onClick: () => openBatchUpdate(),
    show: () => Boolean(tableRef.value?.getSelectPks?.()?.length)
  };

  return { openBatchUpdate, batchUpdateButton };
}
