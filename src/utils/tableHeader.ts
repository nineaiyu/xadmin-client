/**
 * 表格表头统一样式（单一来源）。
 *
 * 口径：表头退为结构线——`--fill-subtle` 底纹 + 12px/600 muted 文字，
 * 与表体分面（表体白底 + hairline 行分隔），数据是主角；
 * 明暗主题随语义槽自动反转。
 * 列表页（RePlusPage）、只读表（ReReadonlyTable）与各设置面板表格共用本常量，
 * 避免四处重复同一份内联对象。
 */
export const TABLE_HEADER_CELL_STYLE = {
  background: "hsl(var(--fill-subtle))",
  color: "hsl(var(--fg-muted))",
  fontWeight: "var(--font-weight-semibold)",
  fontSize: "var(--font-size-xs)"
};
