import { h, ref, type Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import type { OperationProps } from "@/components/RePlusPage";
import { useDialogForm } from "@/hooks/useDialogForm";
import type { ApiResult } from "@/api/types";
import { message } from "@/utils/message";
import { invalidateMetaCache } from "@/utils/metaCache";
import BatchUpdateForm from "./BatchUpdateForm.vue";

/**
 * 批量更新通用弹窗：勾选行 → 选择字段与值 → POST {baseApi}/batch-update。
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

export type BatchUpdateApi = {
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
  /**
   * 当前角色是否持有 `batchUpdate:<Component>` 权限（缺省 false，fail-closed）。
   * 页面必须显式传入：只看勾选就显示按钮会让无权限角色点开必 403。
   */
  canBatch?: boolean;
}) {
  const { t, api, tableRef, fields, canBatch = false } = options;
  const formRef = ref();

  const openBatchUpdate = () => {
    const pks = (tableRef.value?.getSelectPks?.() ?? []) as Array<
      string | number
    >;
    if (!pks.length) {
      message(t("batchUpdate.selectFirst"), { type: "warning" });
      return;
    }
    const { beforeSure } = useDialogForm<Record<string, unknown>>({
      readPayload: () => {
        const payload = formRef.value?.getPayload?.();
        if (!payload) {
          message(t("batchUpdate.fieldRequired"), { type: "warning" });
          return null;
        }
        return payload;
      },
      submit: payload => api.batchUpdate(pks, payload, "batchUpdate"),
      onSuccess: res => {
        // 与 handleOperation 同口径：写成功即失效共享元数据缓存并提示后端详情
        invalidateMetaCache();
        message(String(res.detail ?? t("results.success")), {
          type: "success"
        });
        tableRef.value?.handleGetData?.();
      },
      onFail: res =>
        message(`${t("results.failed")}，${res.detail}`, { type: "error" })
    });
    addDialog({
      title: t("batchUpdate.title", { count: pks.length }),
      width: dialogSize("sm"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () => h(BatchUpdateForm, { ref: formRef, fields }),
      beforeSure
    });
  };

  const batchUpdateButton: NonNullable<OperationProps["buttons"]>[number] = {
    text: t("batchUpdate.button"),
    code: "batchUpdate",
    props: { type: "primary", plain: true },
    onClick: () => openBatchUpdate(),
    show: () => Boolean(canBatch && tableRef.value?.getSelectPks?.()?.length)
  };

  return { openBatchUpdate, batchUpdateButton };
}
