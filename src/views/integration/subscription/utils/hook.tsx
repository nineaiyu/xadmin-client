import { reactive } from "vue";
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

/**
 * Webhook 订阅：CRUD + 测试 + 行内启停。
 *
 * - 新建/编辑走框架元数据表单，页面在 `useSubscriptionFormOptions` 里把
 *   `events`（JSONField）换成事件目录多选、`secret` 换成密码框并给出新建必填规则；
 * - is_active 行内开关由页面接管渲染与乐观回滚（列渲染层覆盖框架默认单元格）；
 * - 删除保留框架默认入口（带二次确认）。
 */
export function useWebhookSubscription() {
  const { t } = useI18n();
  const api = reactive(webhookSubscriptionApi);
  const auth = usePageAuth("WebhookSubscription");
  const canTest = hasAuth("test:WebhookSubscription");

  const { events, eventLabel } = useSubscriptionEvents({ t });
  const { addOrEditOptions } = useSubscriptionFormOptions({ t, events });

  /** 行内启停：乐观更新，失败回滚（框架默认编辑按钮关闭后的等价能力） */
  const toggleActive = async (row: WebhookSubscriptionItem, value: boolean) => {
    row.is_active = value;
    const res = await webhookSubscriptionApi
      .partialUpdate(row.pk, { is_active: value })
      .catch(normalizeError);
    if (isSuccess(res)) {
      message(t("webhook.saveOk"), { type: "success" });
      return;
    }
    row.is_active = !value;
    if (res.detail) message(String(res.detail), { type: "warning" });
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

  const { listColumnsFormat } = useSubscriptionColumns({
    canEdit: Boolean(auth.partialUpdate || auth.update),
    eventLabel,
    toggleActive
  });

  const { operationButtonsProps } = useSubscriptionButtons({
    t,
    canTest,
    testSubscription
  });

  return {
    api,
    auth,
    addOrEditOptions,
    listColumnsFormat,
    operationButtonsProps
  };
}
