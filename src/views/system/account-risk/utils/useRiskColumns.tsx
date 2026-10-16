import { h, type VNode } from "vue";
import { useI18n } from "vue-i18n";
import { ElTag } from "element-plus";
import type { RecordType } from "plus-pro-components";
import {
  formatPageColumns,
  type PageTableColumn
} from "@/components/RePlusPage";
import {
  LEVEL_TAG,
  RISK_TYPE_KEYS,
  STATUS_TAG,
  pick,
  type TagType
} from "./display";

/**
 * 账号安全风险清单的列渲染。
 * 自 useAccountRisk 拆出（行为不变）：风险类型 / 等级 / 状态彩色标签 +
 * 时间列统一格式化（ISO 字符串截断展示）。
 */
export function useRiskColumns() {
  const { t } = useI18n();

  const renderTag = (
    row: RecordType,
    key: string,
    mapping: Record<string, TagType>
  ): VNode => {
    const { value, label } = pick(row?.[key]);
    if (!value) return h("span", "-");
    return h(
      ElTag,
      { type: mapping[value] ?? "info", effect: "light" },
      () => label || value
    );
  };

  const formatHandledAtCreatedTimeColumn = (column: PageTableColumn) => {
    column["cellRenderer"] = scope => {
      const value = scope.row?.[column.prop as string];
      return h(
        "span",
        value ? String(value).replace("T", " ").slice(0, 19) : "-"
      );
    };
  };

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      risk_type: column => {
        column["cellRenderer"] = scope => {
          const { value, label } = pick(scope.row?.risk_type);
          const key = RISK_TYPE_KEYS[value];
          return h(ElTag, { type: "info", effect: "plain" }, () =>
            key ? t(key) : label || value
          );
        };
      },
      level: column => {
        column["cellRenderer"] = scope =>
          renderTag(scope.row, "level", LEVEL_TAG);
      },
      status: column => {
        column["cellRenderer"] = scope =>
          renderTag(scope.row, "status", STATUS_TAG);
      },
      handled_at: formatHandledAtCreatedTimeColumn,
      created_time: formatHandledAtCreatedTimeColumn
    });

  return { listColumnsFormat };
}
