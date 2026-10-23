import { h, ref, type Ref, type UnwrapNestedRefs } from "vue";
import { useI18n } from "vue-i18n";
import type {
  accountRiskApi,
  AccountRiskHandleAction
} from "@/api/system/security";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { useDialogForm } from "@/hooks/useDialogForm";
import { message } from "@/utils/message";
import { invalidateMetaCache } from "@/utils/metaCache";
import RiskHandleForm from "../components/RiskHandleForm.vue";

/**
 * 账号安全风险的处置弹窗。
 * 自 useAccountRisk 拆出（行为不变）：单行/批量共用同一弹窗，
 * 批量失败明细逐条提示（最多 3 条防刷屏）；详情抽屉见 useRiskDetail。
 */

/** 处置表单实例（getPayload 契约；动作取服务端枚举，备注自由文本） */
type RiskHandleFormInstance = {
  getPayload: () => { action: AccountRiskHandleAction; remark: string };
};

export function useRiskDialogs({
  api,
  tableRef,
  onHandled,
  actions
}: {
  // 同 useRiskStats：reactive 映射后的公有面类型
  api: UnwrapNestedRefs<typeof accountRiskApi>;
  tableRef: Ref;
  /** 处置成功后的刷新回调（列表由调用方刷新，统计面板经该回调刷新） */
  onHandled: () => void;
  /** 服务端下发的可用动作（stats.actions）；缺省由表单回退全集 */
  actions?: AccountRiskHandleAction[];
}) {
  const { t } = useI18n();

  /** 处置弹窗（单行/批量共用）：表单在 RiskHandleForm 内，载荷经 getPayload 取回 */
  const handleFormRef = ref<RiskHandleFormInstance>();
  const handleDialog = (pks: Array<string | number>) => {
    const { beforeSure } = useDialogForm<{
      action: AccountRiskHandleAction;
      remark: string;
    }>({
      formRef: handleFormRef,
      submit: payload =>
        pks.length > 1
          ? api.batchHandle(pks, payload.action, payload.remark)
          : api.handle(pks[0], payload.action, payload.remark),
      onSuccess: res => {
        invalidateMetaCache();
        message(String(res.detail ?? t("results.success")), {
          type: "success"
        });
        tableRef.value?.handleGetData?.();
        onHandled();
        // 批量处置为逐项独立执行（code 成功也含失败项）：补逐条 pk+原因明细，
        // 与审批批量转交的部分失败提示同范式（明细最多展示 3 条防刷屏）
        const failures =
          (
            res.data as {
              failures?: Array<{ pk: string; reason: string }>;
            } | null
          )?.failures ?? [];
        if (pks.length > 1 && failures.length) {
          message(
            t("accountRisk.batchHandlePartial", {
              n: failures.length,
              detail: failures
                .slice(0, 3)
                .map(item => `${item.pk}: ${item.reason}`)
                .join("；")
            }),
            { type: "warning" }
          );
        }
      },
      onFail: res =>
        message(`${t("results.failed")}，${res.detail}`, { type: "error" })
    });
    addDialog({
      title: t("accountRisk.handleTitle", { count: pks.length }),
      width: dialogSize("sm"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () => h(RiskHandleForm, { ref: handleFormRef, actions }),
      beforeSure
    });
  };

  return { handleDialog };
}
