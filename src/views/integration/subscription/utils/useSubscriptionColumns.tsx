import { h } from "vue";
import { ElSwitch, ElTag } from "element-plus";
import {
  formatPageColumns,
  type PageTableColumn
} from "@/components/RePlusPage";
import type { WebhookSubscriptionItem } from "@/api/task/webhook";

/**
 * Webhook 订阅列渲染（自 subscription/utils/hook 抽出）：事件标签列表与
 * is_active 行内开关（乐观更新逻辑在装配层，失败回滚行内值）。
 */
export function useSubscriptionColumns({
  t,
  canEdit,
  eventLabel,
  toggling,
  toggleActive
}: {
  t: (key: string) => string;
  canEdit: boolean;
  eventLabel: (key: string) => string;
  /** 启停 PATCH 进行中的行主键（开关 loading + 禁点） */
  toggling: Set<string>;
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
      has_secret: column => {
        column["cellRenderer"] = ({ row }) =>
          h(
            ElTag,
            {
              size: "small",
              type: (row as WebhookSubscriptionItem).has_secret
                ? "success"
                : "info"
            },
            () =>
              (row as WebhookSubscriptionItem).has_secret
                ? t("webhook.secretConfigured")
                : t("webhook.secretMissing")
          );
      },
      is_active: column => {
        column["cellRenderer"] = ({ row }) => {
          const item = row as WebhookSubscriptionItem;
          const pending = toggling.has(item.pk);
          return h(ElSwitch, {
            modelValue: item.is_active,
            loading: pending,
            disabled: !canEdit || pending,
            "onUpdate:modelValue": (value: string | number | boolean) =>
              toggleActive(item, value as boolean)
          });
        };
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
