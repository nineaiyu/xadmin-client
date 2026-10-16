import { h, ref, type Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import {
  webhookSubscriptionApi,
  type WebhookEvent,
  type WebhookSubscriptionItem
} from "@/api/task/webhook";
import { useDialogForm } from "@/hooks/useDialogForm";
import SubscriptionForm from "../components/SubscriptionForm.vue";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 新建/编辑弹窗（自 subscription/utils/hook 抽出）：关闭框架默认表单按钮，
 * 统一走 ReDialog + SubscriptionForm（事件多选语义）。
 */
export function useSubscriptionDialog({
  t,
  refresh,
  events
}: {
  t: TFunction;
  refresh: () => void;
  events: Ref<WebhookEvent[]>;
}) {
  const formRef = ref<InstanceType<typeof SubscriptionForm>>();

  const openDialog = (row: WebhookSubscriptionItem | null) => {
    formRef.value = undefined;
    // 显式指定载荷泛型：ref 包装的实例类型无法从 getPayload 返回类型反推（TS 退化 unknown）
    const { beforeSure } = useDialogForm<Record<string, unknown>>({
      formRef,
      submit: payload =>
        row
          ? webhookSubscriptionApi.partialUpdate(row.pk, payload)
          : webhookSubscriptionApi.create(payload),
      successText: t("webhook.saveOk"),
      // 先关弹窗再刷新列表，避免刷新耗时导致弹窗滞留（useDialogForm 内 done 先于回调）
      onSuccess: refresh
    });
    addDialog({
      title: row ? t("webhook.edit") : t("webhook.create"),
      width: dialogSize("md"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () =>
        h(SubscriptionForm, { ref: formRef, row, events: events.value }),
      beforeSure
    });
  };

  return { openDialog };
}
