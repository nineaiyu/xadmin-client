/**
 * RePlusPage 列装配的纯函数段（自 useBaseColumns 抽出，便于单测直测）：
 * 展示名兜底链、choices 截断降级、校验规则生成、默认值形态与详情渲染类型映射。
 * 这些函数不持有 Vue 状态、不发起请求；装配流程见同目录 columns.tsx。
 */

import { FIELD_TYPES } from "./fieldTypeRegistry";
import { formatPublicLabels } from "./index";
import type { ColumnMeta } from "./fieldTypeRegistry";
import type { PageColumn } from "./types";

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

/**
 * 生成表单校验规则：按字段类型能力清单（fieldTypeRegistry）的 rule 面查表，
 * 未登记专属规则的类型兜底为通用 required 规则。
 */
export function buildColumnRule(
  column: ColumnMeta,
  message: string
): Record<string, unknown>[] {
  const factory = FIELD_TYPES[column.input_type]?.rule;
  if (factory) return factory(column, message);
  return [
    {
      required: column.required,
      message: message,
      trigger: "blur"
    }
  ];
}

/**
 * 表单默认值形态：labeled 系列把标量包成 {value}（与选择器回显结构一致），
 * 多选包成数组；其余沿用元数据 default 原值。
 *
 * 契约：labeled 系列提交 {value, label} 对象，后端按字段的 allow_null 校验空值。
 * 默认值缺失（null/undefined）时返回 undefined——不再构造 {value: undefined}
 * （它会被 JSON 序列化成 `{}` 脏载荷，后端会以「不允许为空」拒绝）。
 */
export function columnDefaultValue(column: ColumnMeta): unknown {
  const value = column?.default;
  if (value === undefined || value === null) {
    return undefined;
  }
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
