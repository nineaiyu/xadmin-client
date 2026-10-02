/**
 * RePlusPage 列装配的纯函数段（自 useBaseColumns 抽出，便于单测直测）：
 * 展示名兜底链、choices 截断降级、校验规则生成、默认值形态与详情渲染类型映射。
 * 这些函数不持有 Vue 状态、不发起请求；装配流程见同目录 columns.tsx。
 */

import { isEmail, isNumber } from "@pureadmin/utils";
import { formatPublicLabels } from "./index";
import type { PageColumn } from "./types";
import type { SearchColumnsResult, SearchFieldsResult } from "@/api/types";

/** 列元数据：同时兼容 search-fields 与 search-columns 接口返回（与 PlusColumnMeta 同口径） */
type ColumnMeta = SearchFieldsResult["data"][0] &
  Partial<SearchColumnsResult["data"][0]>;

type ColumnLabelDeps = {
  t: (arg0: string, arg1?: object) => string;
  te: (arg0: string, arg1?: string) => boolean;
  localeName: string;
};

/**
 * 列展示名兜底链：i18n 词条 → 服务端 label（契约允许 null，模型无 verbose_name 时为 null）→ 字段名。
 * 不兜底会把 null 透传给表头与校验文案（strict 下即类型错误）。
 */
export function resolveColumnLabel(
  { t, te, localeName }: ColumnLabelDeps,
  column: { key: string; label: string | null }
): string {
  return (
    formatPublicLabels(t, te, column.key, localeName) ??
    column.label ??
    column.key
  );
}

/**
 * 降级处理：后端关联列的 choices 超过 SEARCH_CHOICES_MAX_COUNT 时会被截断，
 * 并带出 choices_truncated 标记。此时下拉必须开启本地过滤，并在开发环境提示
 * 开发者将该字段改为 api-search-* 远程搜索组件（SearchUser/SearchDept/SearchRole 模式）。
 */
export function applyChoicesTruncated(
  column: ColumnMeta,
  item: Pick<PageColumn, "fieldProps">
): void {
  if (!column?.choices_truncated) return;
  item.fieldProps = { ...(item.fieldProps ?? {}), filterable: true };
  if (import.meta.env.DEV) {
    console.warn(
      `[RePlusPage] 字段 "${column.key}" 的 choices 已被后端截断，` +
        `请为其自定义 input_type="api-search-*" 以启用远程搜索`
    );
  }
}

/** email / integer / 通用 required 三类校验规则（与原 switch-case 逐字段等价） */
export function buildColumnRule(
  column: ColumnMeta,
  message: string
): Record<string, unknown>[] {
  switch (column.input_type) {
    case "email":
      return [
        {
          required: column.required,
          validator: (
            rule: unknown,
            value: unknown,
            callback: (error?: Error) => void
          ) => {
            if (value === "" || !value) {
              callback();
            } else if (!isEmail(value as string)) {
              callback(new Error(message));
            } else {
              callback();
            }
          },
          trigger: "blur"
        }
      ];
    case "integer":
      return [
        {
          required: column.required,
          validator: (
            rule: unknown,
            value: unknown,
            callback: (error?: Error) => void
          ) => {
            if (value && !isNumber(value)) {
              callback(new Error("field must be a number"));
            } else {
              callback();
            }
          },
          trigger: "blur"
        }
      ];
    default:
      return [
        {
          required: column.required,
          message: message,
          trigger: "blur"
        }
      ];
  }
}

/**
 * 表单默认值形态：labeled 系列把标量包成 {value}（与选择器回显结构一致），
 * 多选包成数组；其余沿用元数据 default 原值。
 */
export function columnDefaultValue(column: ColumnMeta): unknown {
  const value = column?.default;
  if (column.input_type === "labeled_choice") {
    return { value };
  }
  if (column.input_type === "labeled_multiple_choice") {
    return [{ value }];
  }
  if (column.input_type === "multiple choice") {
    return [value];
  }
  return value;
}

/** 详情渲染类型映射：自定义 api-search 单选走 object_related_field，多选走 m2m_related_field */
export function detailInputType(column: ColumnMeta): string {
  let input_type = column.input_type;
  if (input_type.startsWith("api-search-")) {
    input_type = "object_related_field";
    if (column.multiple) {
      input_type = "m2m_related_field";
    }
  }
  return input_type;
}
