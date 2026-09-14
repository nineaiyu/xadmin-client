import { h, reactive, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElTag } from "element-plus";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import {
  handleOperation,
  type OperationProps,
  type PageTableColumn
} from "@/components/RePlusPage";
import {
  webhookDeliveryApi,
  type WebhookDeliveryItem
} from "@/api/system/webhook";
import {
  choiceValue,
  statusTagProps,
  type StatusTagType,
  type StatusValue
} from "@/utils/dict";

/** 投递状态兜底配色（字典未接入时的本地映射，与模型 Status 取值一致） */
const DELIVERY_STATUS_TAG: Record<string, StatusTagType> = {
  pending: "info",
  success: "success",
  failed: "warning",
  exhausted: "danger"
};

/** 状态字段归一取值：{value,label} 对象与历史标量两种形态兼容 */
const statusValue = (status: WebhookDeliveryItem["status"]) =>
  choiceValue(status as StatusValue);

/**
 * 投递审计：只读 + 重试。
 *
 * - 详情走框架默认按钮（行数据本地渲染，不请求 retrieve，无权限点缺口）；
 * - 新增/编辑/删除按钮因无对应权限点自然不显示；
 * - status 为 LabeledChoiceField（{value,label}）：label 优先渲染中文，
 *   配色走 statusTagProps（字典色优先、本地映射兜底）；
 * - 状态过滤（status/event/subscription）由后端 DeliveryFilter 元数据驱动。
 */
export function useWebhookDelivery(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(webhookDeliveryApi);
  const auth = reactive({ ...getDefaultAuths("WebhookDelivery") });
  const canRetry = hasAuth("retry:WebhookDelivery");

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "status":
          column["cellRenderer"] = ({ row }) => {
            const status = (row as WebhookDeliveryItem).status;
            const value = statusValue(status);
            const label =
              typeof status === "object" && status !== null
                ? (status.label ?? value)
                : value;
            return h(
              ElTag,
              {
                size: "small",
                ...statusTagProps(status as StatusValue, DELIVERY_STATUS_TAG)
              },
              () => label
            );
          };
          break;
        case "response_body":
          column["minWidth"] = 200;
          break;
      }
    });
    return columns;
  };

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
    width: 140,
    buttons: [
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

  return { api, auth, listColumnsFormat, operationButtonsProps };
}
