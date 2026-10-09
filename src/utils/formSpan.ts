/**
 * 表单栅格档位：页面自绘表单（设置页、个人资料页等）共用的响应式列宽。
 *
 * 取值即 Element Plus 栅格断点（sm ≥768 / md ≥992 / lg ≥1200 / xl ≥1920），
 * 可直接作为 `colProps` 交给 `el-col` / PlusForm。两档覆盖绝大多数表单：
 *
 * - `FORM_SPAN_FULL`：多行文本、JSON、上传等大块控件，独占整行；
 * - `FORM_SPAN_FIELD`：单行控件（文本 / 数值 / 下拉 / 日期 / 开关），宽屏一行三个、
 *   中屏一行两个——页面容器不再限宽，靠列数把控件宽度收住，既不留大片空白，
 *   也不会把输入框拉成长条。
 *
 * 小屏（sm 以下）一律整行，避免移动端多列挤压。
 */

/** 栅格占位（键与 Element Plus 断点同名） */
export interface FormFieldSpan {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

/** 整行：多行文本、大块编辑器、上传类 */
export const FORM_SPAN_FULL: FormFieldSpan = {
  xs: 24,
  sm: 24,
  md: 24,
  lg: 24,
  xl: 24
};

/** 单行控件：≥1200 一行三个，992-1200 一行两个，更小整行 */
export const FORM_SPAN_FIELD: FormFieldSpan = {
  xs: 24,
  sm: 12,
  md: 12,
  lg: 8,
  xl: 8
};
