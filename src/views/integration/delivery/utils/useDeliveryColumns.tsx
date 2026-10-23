import { h, type Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { ElButton, ElTag } from "element-plus";
import {
  formatPageColumns,
  type PageColumn,
  type PageTableColumn
} from "@/components/RePlusPage";
import type { WebhookDeliveryItem, WebhookEvent } from "@/api/task/webhook";
import { statusTagProps, type StatusValue } from "@/utils/dict";
import {
  DELIVERY_STATUS_TAG,
  showDeliveryResponse,
  statusValue
} from "./deliveryAudit";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 投递审计列：状态标签 + 响应体摘要/完整视图；事件筛选复用订阅事件目录 */
export function useDeliveryColumns({
  t,
  events
}: {
  t: TFunction;
  events: Ref<WebhookEvent[]>;
}) {
  const searchColumnsFormat = (columns: PageColumn[]) =>
    columns.map(column => {
      if (column.prop === "event" && events.value.length) {
        column.valueType = "select";
        column.fieldProps = {
          ...(column.fieldProps as object),
          filterable: true,
          clearable: true
        };
        column.options = events.value.map(item => ({
          label: item.label,
          value: item.key
        }));
      }
      return column;
    });

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      status: column => {
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
      },
      response_body: column => {
        column["minWidth"] = 240;
        column["cellRenderer"] = ({ row }) => {
          const item = row as WebhookDeliveryItem;
          const body = String(item.response_body || "");
          const preview = body.length > 120 ? `${body.slice(0, 120)}…` : body;
          if (!body) return h("span", "-");
          return h("div", { class: "flex items-center gap-2" }, [
            h("span", { class: "truncate", title: preview }, preview),
            item.response_body_truncated
              ? h(
                  ElTag,
                  { size: "small", type: "warning", effect: "plain" },
                  () => t("webhook.responseTruncated")
                )
              : null,
            h(
              ElButton,
              {
                link: true,
                type: "primary",
                size: "small",
                onClick: () => showDeliveryResponse(t, item)
              },
              () => t("webhook.viewResponse")
            )
          ]);
        };
      }
    });

  return { listColumnsFormat, searchColumnsFormat };
}
