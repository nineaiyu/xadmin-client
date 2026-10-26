import { h } from "vue";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { useAlert } from "@/hooks/useMessageBox";
import {
  choiceValue,
  type StatusTagType,
  type StatusValue
} from "@/utils/dict";
import type { WebhookDeliveryItem } from "@/api/task/webhook";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 投递状态兜底配色（字典未接入时的本地映射，与模型 Status 取值一致） */
export const DELIVERY_STATUS_TAG: Record<string, StatusTagType> = {
  pending: "info",
  success: "success",
  failed: "warning",
  exhausted: "danger"
};

/** 状态字段归一取值：{value,label} 对象与历史标量两种形态兼容 */
export const statusValue = (status: WebhookDeliveryItem["status"]) =>
  choiceValue(status as StatusValue);

/** 审计详情：请求体 + 签名头（排障自证「发了什么、怎么签的」） */
export function showDeliveryRequest(
  t: TFunction,
  row: WebhookDeliveryItem
): void {
  void useAlert()(
    JSON.stringify(
      {
        payload: row.payload ?? {},
        request_headers: row.request_headers ?? {}
      },
      null,
      2
    ),
    t("webhook.requestTitle"),
    { confirmButtonText: t("webhook.confirm") }
  );
}

/** 完整响应体（列表只展示摘要；超 8KB 由后端截断并标记） */
export function showDeliveryResponse(
  t: TFunction,
  row: WebhookDeliveryItem
): void {
  addDialog({
    title: t("webhook.responseTitle"),
    width: dialogSize("lg"),
    hideFooter: true,
    contentRenderer: () =>
      h(
        "pre",
        {
          class: "whitespace-pre-wrap break-all text-xs leading-5",
          "data-testid": "webhook-response-full"
        },
        row.response_body || t("webhook.responseEmpty")
      )
  });
}
