import { onMounted, ref } from "vue";
import type { useI18n } from "vue-i18n";
import { isSuccess } from "@/api/types";
import { webhookSubscriptionApi, type WebhookEvent } from "@/api/task/webhook";
import { message } from "@/utils/message";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 事件目录（自 subscription/utils/hook 抽出）：进入页面拉取事件清单，
 * 供事件列标签与表单多选共用；拉取失败降级为原始 key 展示（eventLabel 兜底），
 * 但需一次性可读提示——静默会让事件列整列退化为裸标识而无从解释。
 *
 * `enabled=false`（无 events 权限）时不发请求也不提示：事件列按 key 展示是
 * 该权限下的预期降级，反复弹「加载失败」只会误导。
 */
export function useSubscriptionEvents({
  t,
  enabled = true
}: {
  t: TFunction;
  enabled?: boolean;
}) {
  const events = ref<WebhookEvent[]>([]);

  const eventLabel = (key: string) =>
    events.value.find(item => item.key === key)?.label ?? key;

  onMounted(async () => {
    if (!enabled) return;
    const res = await webhookSubscriptionApi.events().catch(() => null);
    if (res && isSuccess(res)) {
      events.value = (res.data as never as WebhookEvent[]) ?? [];
    } else {
      message(t("webhook.eventsLoadFailed"), { type: "warning" });
    }
  });

  return { events, eventLabel };
}
