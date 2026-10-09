import { onMounted, ref } from "vue";
import type { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import { webhookSubscriptionApi, type WebhookEvent } from "@/api/task/webhook";
import { message } from "@/utils/message";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 事件目录（自 subscription/utils/hook 抽出）：进入页面拉取事件清单，
 * 供事件列标签与表单多选共用；拉取失败降级为原始 key 展示（eventLabel 兜底），
 * 但需一次性可读提示——静默会让事件列整列退化为裸标识而无从解释。
 */
export function useSubscriptionEvents({ t }: { t: TFunction }) {
  const events = ref<WebhookEvent[]>([]);

  const eventLabel = (key: string) =>
    events.value.find(item => item.key === key)?.label ?? key;

  onMounted(async () => {
    const res = await webhookSubscriptionApi.events().catch(() => null);
    if (res?.code === SUCCESS_CODE) {
      events.value = (res.data as never as WebhookEvent[]) ?? [];
    } else {
      message(t("webhook.eventsLoadFailed"), { type: "warning" });
    }
  });

  return { events, eventLabel };
}
