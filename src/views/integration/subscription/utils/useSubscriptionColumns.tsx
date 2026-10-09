import { h } from "vue";
import { ElSwitch, ElTag } from "element-plus";
import {
  formatPageColumns,
  type PageTableColumn
} from "@/components/RePlusPage";
import type { WebhookSubscriptionItem } from "@/api/system/webhook";

/**
 * Webhook 订阅列渲染（自 subscription/utils/hook 抽出）：事件标签列表与
 * is_active 行内开关（乐观更新逻辑在装配层，失败回滚行内值）。
 */
export function useSubscriptionColumns({
  canEdit,
  eventLabel,
  toggleActive
}: {
  canEdit: boolean;
  eventLabel: (key: string) => string;
  toggleActive: (row: WebhookSubscriptionItem, value: boolean) => Promise<void>;
}) {
  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      events: column => {
        column["minWidth"] = 200;
        column["cellRenderer"] = ({ row }) => {
          const keys = (row as WebhookSubscriptionItem).events ?? [];
          if (!keys.length) return h("span", "—");
          return h(
            "span",
            { class: "flex flex-wrap justify-center gap-1" },
            keys.map(key =>
              h(ElTag, { key, size: "small" }, () => eventLabel(key))
            )
          );
        };
      },
      is_active: column => {
        column["cellRenderer"] = ({ row }) =>
          h(ElSwitch, {
            modelValue: (row as WebhookSubscriptionItem).is_active,
            disabled: !canEdit,
            "onUpdate:modelValue": (value: string | number | boolean) =>
              toggleActive(row as WebhookSubscriptionItem, value as boolean)
          });
      },
      url: column => {
        column["minWidth"] = 220;
      },
      last_failure: column => {
        column["minWidth"] = 160;
      }
    });

  return { listColumnsFormat };
}
