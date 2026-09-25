/** 只读明细表的列声明：只覆盖展示型表格需要的字段，复杂单元格走具名插槽 */
export type ReadonlyColumn = {
  /** 字段名（与行对象键一致）；仅插槽列可省略 */
  prop?: string;
  /** 表头文案（调用方已 i18n） */
  label?: string;
  width?: string | number;
  minWidth?: string | number;
  align?: "left" | "center" | "right";
  showOverflowTooltip?: boolean;
  fixed?: boolean | "left" | "right";
  /** 具名插槽名：tag/进度/操作等复杂渲染由调用方提供同名插槽 */
  slot?: string;
};
