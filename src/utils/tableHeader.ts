/**
 * 表格表头统一样式（单一来源）。
 *
 * 口径：表头 = 灰底结构带（--fill-muted 底纹 + --fg 深字 + 14px/600）——
 * 与表体拉开「底色 + 字色」双重对比（4.2 口径回归：#f5f7fa 底 / #303133 字），
 * 恢复一眼可辨的信息栅格；明暗主题随语义槽自动反转。
 * 列表页（RePlusPage）、只读表（ReReadonlyTable）与各设置面板表格共用本常量，
 * 避免四处重复同一份内联对象。
 */
export const TABLE_HEADER_CELL_STYLE = {
  background: "hsl(var(--fill-muted))",
  color: "hsl(var(--fg))",
  fontWeight: "var(--font-weight-semibold)",
  fontSize: "var(--font-size-base)"
};
