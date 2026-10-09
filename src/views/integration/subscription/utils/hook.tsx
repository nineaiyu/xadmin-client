import { reactive, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth, usePageAuth } from "@/router/utils";
import { SUCCESS_CODE } from "@/api/types";
import {
  webhookSubscriptionApi,
  type WebhookSubscriptionItem
} from "@/api/task/webhook";
import { normalizeError } from "@/utils/apiError";
import { message } from "@/utils/message";
import { useSubscriptionEvents } from "./useSubscriptionEvents";
import { useSubscriptionDialog } from "./useSubscriptionDialog";
import { useSubscriptionColumns } from "./useSubscriptionColumns";
import { useSubscriptionButtons } from "./useSubscriptionButtons";

/**
 * Webhook 订阅：CRUD + 测试 + 行内启停。
 *
 * - 新建/编辑关闭框架默认表单按钮，统一走 ReDialog + SubscriptionForm（事件多选语义）；
 * - is_active 自定义开关渲染：默认编辑按钮关闭（auth.partialUpdate=false）会连带
 *   禁用框架 boolean 列开关，故在列渲染层接管，失败回滚行内值；
 * - 删除保留框架默认入口（带二次确认）。
 *
 * 职责拆分：
 * - useSubscriptionEvents   事件目录拉取与标签回落；
 * - useSubscriptionDialog   新建/编辑弹窗；
 * - useSubscriptionColumns  列渲染（含行内启停开关）；
 * - useSubscriptionButtons  工具栏与行操作按钮装配。
 */
export function useWebhookSubscription(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(webhookSubscriptionApi);
  const auth = usePageAuth("WebhookSubscription");
  auth.create = false;
  auth.update = false;
  auth.partialUpdate = false;
  const canCreate = hasAuth("create:WebhookSubscription");
  const canEdit = hasAuth("partialUpdate:WebhookSubscription");
  const canTest = hasAuth("test:WebhookSubscription");

  const refresh = () => tableRef.value?.handleGetData();

  const { events, eventLabel } = useSubscriptionEvents({ t });

  /** 行内启停：乐观更新，失败回滚（框架默认编辑按钮关闭后的等价能力） */
  const toggleActive = async (row: WebhookSubscriptionItem, value: boolean) => {
    row.is_active = value;
    const res = await webhookSubscriptionApi
      .partialUpdate(row.pk, { is_active: value })
      .catch(normalizeError);
    if (res.code === SUCCESS_CODE) {
      message(t("webhook.saveOk"), { type: "success" });
      return;
    }
    row.is_active = !value;
    if (res.detail) message(String(res.detail), { type: "warning" });
  };

  const { openDialog } = useSubscriptionDialog({ t, refresh, events });

  const testSubscription = async (row: WebhookSubscriptionItem) => {
    // 异常归一为可读失败结果：测试触发失败（回调地址不通等）需给出可读原因
    const res = await webhookSubscriptionApi.test(row.pk).catch(normalizeError);
    if (res.code === SUCCESS_CODE) {
      message(String(res.detail ?? t("webhook.testDispatched")), {
        type: "success"
      });
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  };

  const { listColumnsFormat } = useSubscriptionColumns({
    canEdit,
    eventLabel,
    toggleActive
  });

  const { operationButtonsProps, tableBarButtonsProps } =
    useSubscriptionButtons({
      t,
      flags: { canCreate, canEdit, canTest },
      testSubscription,
      openDialog
    });

  return {
    api,
    auth,
    listColumnsFormat,
    operationButtonsProps,
    tableBarButtonsProps
  };
}
