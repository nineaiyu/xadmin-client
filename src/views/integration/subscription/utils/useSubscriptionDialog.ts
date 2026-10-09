import { h, ref, type Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import {
  webhookSubscriptionApi,
  type WebhookEvent,
  type WebhookSubscriptionItem
} from "@/api/system/webhook";
import { normalizeError } from "@/utils/apiError";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
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
    addDialog({
      title: row ? t("webhook.edit") : t("webhook.create"),
      width: dialogSize("md"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () =>
        h(SubscriptionForm, { ref: formRef, row, events: events.value }),
      beforeSure: async (done, { closeLoading }) => {
        const payload = formRef.value?.getPayload();
        if (!payload) {
          closeLoading();
          return;
        }
        // 异常归一为可读失败结果：避免请求异常时 beforeSure 抛错、弹窗 loading 悬挂
        const res = await (
          row
            ? webhookSubscriptionApi.partialUpdate(row.pk, payload)
            : webhookSubscriptionApi.create(payload)
        ).catch(normalizeError);
        if (res.code === SUCCESS_CODE) {
          message(t("webhook.saveOk"), { type: "success" });
          // 先关弹窗再刷新列表，避免刷新耗时导致弹窗滞留
          done();
          refresh();
          return;
        }
        if (res.detail) message(String(res.detail), { type: "warning" });
        closeLoading();
      }
    });
  };

  return { openDialog };
}
