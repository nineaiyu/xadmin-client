import { reactive, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth, usePageAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { handleOperation, type OperationProps } from "@/components/RePlusPage";
import {
  webhookDeliveryApi,
  type WebhookDeliveryItem
} from "@/api/task/webhook";
import { useSubscriptionEvents } from "../../subscription/utils/useSubscriptionEvents";
import { showDeliveryRequest, statusValue } from "./deliveryAudit";
import { useDeliveryColumns } from "./useDeliveryColumns";

/**
 * 投递审计：只读 + 重试。
 *
 * - 详情走框架默认按钮（行数据本地渲染，不请求 retrieve，无权限点缺口）；
 * - 新增/编辑入口不存在；删除入口显式关闭（审计记录不可删）；
 * - status 为 LabeledChoiceField（{value,label}）：label 优先渲染中文，
 *   配色走 statusTagProps（字典色优先、本地映射兜底）；
 * - 状态过滤（status/event/subscription）由后端 DeliveryFilter 元数据驱动。
 */
export function useWebhookDelivery(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(webhookDeliveryApi);
  const auth = usePageAuth("WebhookDelivery");
  // 审计记录不可删：后端已不注册 destroy / batch-destroy 路由，页面同步关闭
  // 框架默认删除入口（种子里残留的旧权限点也不再产生按钮）。
  auth.destroy = false;
  auth.batchDestroy = false;
  const canRetry = hasAuth("retry:WebhookDelivery");
  const canReadEvents = hasAuth("events:WebhookSubscription");

  // 事件筛选与订阅页共用同一份目录；无目录权限时保留手输文本框
  const { events } = useSubscriptionEvents({ t, enabled: canReadEvents });
  const { listColumnsFormat, searchColumnsFormat } = useDeliveryColumns({
    t,
    events
  });

  const retry = (row: WebhookDeliveryItem, loading?: { value: boolean }) => {
    if (loading) loading.value = true;
    handleOperation({
      t,
      apiReq: webhookDeliveryApi.retry(row.pk),
      success() {
        message(t("webhook.retryOk"), { type: "success" });
        tableRef.value?.handleGetData();
      },
      requestEnd() {
        if (loading) loading.value = false;
      }
    });
  };

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 220,
    buttons: [
      {
        text: t("webhook.viewRequest"),
        code: "viewRequest",
        props: { type: "info", link: true },
        onClick: ({ row }) =>
          showDeliveryRequest(t, row as WebhookDeliveryItem),
        index: 5
      },
      {
        text: t("webhook.retry"),
        code: "retry",
        props: { type: "primary", link: true },
        onClick: ({ row, loading }) =>
          retry(row as WebhookDeliveryItem, loading),
        show: row =>
          Boolean(
            canRetry &&
            ["failed", "exhausted"].includes(
              statusValue((row as WebhookDeliveryItem)?.status)
            )
          ) && 10
      }
    ]
  });

  return {
    api,
    auth,
    listColumnsFormat,
    searchColumnsFormat,
    operationButtonsProps
  };
}
