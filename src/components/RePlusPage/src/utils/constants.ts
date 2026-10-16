import { $t, transformI18n } from "@/plugins/i18n";

export const ExportImportFormatOptions = [
  { label: "CSV", value: "csv" },
  { label: "Excel", value: "xlsx" }
];

/**
 * 框架注入列（选择列 / 操作列）的 `_column.key`。
 *
 * 它们由 `usePlusPageColumns` 在列装配时无条件追加，**不来自后端元数据**——
 * 判定「元数据是否到达」时必须排除，否则选择列恒存在会让判定恒为真
 * （元数据缺失警示条与搜索卡片高度占位都会因此失效）。
 */
export const SELECTION_COLUMN_KEY = "selection";
export const OPERATION_COLUMN_KEY = "operation";
export const INJECTED_COLUMN_KEYS = [
  SELECTION_COLUMN_KEY,
  OPERATION_COLUMN_KEY
] as const;

export const selectBooleanOptions = [
  {
    label: transformI18n($t("labels.enable")),
    value: true
  },
  {
    label: transformI18n($t("labels.disable")),
    value: false
  }
];
