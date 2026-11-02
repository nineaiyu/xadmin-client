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
  /**
   * 单元格文本格式化（与 el-table-column formatter 同签名，row 取行对象）。
   * 适用：时间/枚举等只需把原值转成可读文本的列；tag/进度等复杂渲染仍走 slot。
   */
  formatter?: (
    row: Record<string, unknown>,
    column: unknown,
    cellValue: unknown,
    index: number
  ) => string;
  /** 具名插槽名：tag/进度/操作等复杂渲染由调用方提供同名插槽 */
  slot?: string;
};
