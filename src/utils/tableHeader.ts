/**
 * 表格表头统一样式（单一来源）。
 *
 * 口径：表头与卡面同底（`--el-bg-color`，即内容纸表面），不复用 hover 底色——
 * vue-vben-admin 的表头即无独立底纹，与表体同面，靠字重与单行省略区分层级；
 * 对比度由主文本色保证，主题切换自动跟随。
 * 列表页（RePlusPage）、只读表（ReReadonlyTable）与各设置面板表格共用本常量，
 * 避免四处重复同一份内联对象。
 */
export const TABLE_HEADER_CELL_STYLE = {
  background: "var(--el-bg-color)",
  color: "var(--el-text-color-primary)"
};
