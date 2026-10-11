/**
 * 表格表头统一样式（单一来源）。
 *
 * 口径（2026-10-09 排版规范）：表头用 hover 底色作浅灰底纹、主文本色作字色，
 * 无竖网格线；取值全部走 Element Plus 语义变量，主题切换自动跟随。
 * 列表页（RePlusPage）、只读表（ReReadonlyTable）与各设置面板表格共用本常量，
 * 避免四处重复同一份内联对象。
 */
export const TABLE_HEADER_CELL_STYLE = {
  background: "var(--el-table-row-hover-bg-color)",
  color: "var(--el-text-color-primary)"
};
