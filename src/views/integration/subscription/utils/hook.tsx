import { reactive, ref, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth, usePageAuth } from "@/router/utils";
import { isSuccess } from "@/api/types";
import {
  webhookSubscriptionApi,
  type WebhookSubscriptionItem
} from "@/api/task/webhook";
import { normalizeError } from "@/utils/apiError";
import { message } from "@/utils/message";
import { useSubscriptionEvents } from "./useSubscriptionEvents";
import { useSubscriptionFormOptions } from "./useSubscriptionFormOptions";
import { useSubscriptionColumns } from "./useSubscriptionColumns";
import { useSubscriptionButtons } from "./useSubscriptionButtons";
import { useSubscriptionSecret } from "./useSubscriptionSecret";

/**
 * Webhook 订阅：CRUD + 测试 + 行内启停。
 *
 * - 新建/编辑走框架元数据表单，页面在 `useSubscriptionFormOptions` 里把
 *   `events`（JSONField）换成事件目录多选、`secret` 换成密码框并给出新建必填规则；
 * - is_active 行内开关由页面接管渲染与乐观回滚（列渲染层覆盖框架默认单元格）；
 * - 删除保留框架默认入口（带二次确认）。
 */
export function useWebhookSubscription(tableRef: Ref = ref()) {
  const { t } = useI18n();
  const api = reactive(webhookSubscriptionApi);
  const auth = usePageAuth("WebhookSubscription");
  const canTest = hasAuth("test:WebhookSubscription");
  const canRotate = hasAuth("rotateSecret:WebhookSubscription");
  // 事件目录是独立权限点：无权限时不拉取，避免每次进页都弹「加载失败」
  const canReadEvents = hasAuth("events:WebhookSubscription");

  const { events, eventLabel } = useSubscriptionEvents({
    t,
    enabled: canReadEvents
  });
  const { addOrEditOptions } = useSubscriptionFormOptions({ t, events });

  /** 行内启停：乐观更新 + in-flight 去重，成功后刷新列表带回 last_failure 等派生列 */
  const toggling = reactive(new Set<string>());
  const toggleActive = async (row: WebhookSubscriptionItem, value: boolean) => {
    if (toggling.has(row.pk)) return;
    row.is_active = value;
    toggling.add(row.pk);
    try {
      const res = await webhookSubscriptionApi
        .partialUpdate(row.pk, { is_active: value })
        .catch(normalizeError);
      if (isSuccess(res)) {
        message(t("webhook.saveOk"), { type: "success" });
        tableRef.value?.handleGetData?.();
        return;
      }
      row.is_active = !value;
      if (res.detail) message(String(res.detail), { type: "warning" });
    } finally {
      toggling.delete(row.pk);
    }
  };

  const testSubscription = async (row: WebhookSubscriptionItem) => {
    // 异常归一为可读失败结果：测试触发失败（回调地址不通等）需给出可读原因
    const res = await webhookSubscriptionApi.test(row.pk).catch(normalizeError);
    if (isSuccess(res)) {
      message(String(res.detail ?? t("webhook.testDispatched")), {
        type: "success"
      });
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  };

  const { rotateSecret } = useSubscriptionSecret({ t });

  const { listColumnsFormat } = useSubscriptionColumns({
    t,
    canEdit: Boolean(auth.partialUpdate || auth.update),
    eventLabel,
    toggling,
    toggleActive
  });

  const { operationButtonsProps } = useSubscriptionButtons({
    t,
    canTest,
    canRotate,
    testSubscription,
    rotateSecret
  });

  return {
    api,
    auth,
    addOrEditOptions,
    listColumnsFormat,
    operationButtonsProps
  };
}
