/** el-tag 的颜色语义（与 Element Plus 的 Tag type 同集合） */
export type StatTagType = "primary" | "success" | "warning" | "info" | "danger";

/**
 * 统计条 / 统计网格的单个指标。
 *
 * 展示值优先取 `text`（可带单位、空值占位），其次 `value`；`type` 只表达颜色
 * 语义，不承载业务判断——语义映射由调用方组装。
 */
export interface StatItem {
  /** 稳定标识（同时作为 `data-testid="stat-{key}"`） */
  key: string;
  /** 指标名 */
  label: string;
  /** 数值（无 `text` 时渲染） */
  value?: number | string;
  /** 直接展示的文本（优先于 `value`） */
  text?: string;
  /** el-tag 颜色语义 */
  type?: StatTagType;
  /** StatBar 中以 el-tag chip 形态渲染（默认轻量「标签 + 值」文本） */
  tag?: boolean;
  /** chip 可点击：点击时 StatBar 抛出 `itemClick` */
  clickable?: boolean;
  /** 悬浮提示（缺省取展示值） */
  title?: string;
  /** 分组标题：StatBar 中相邻同组项渲染为一行 */
  group?: string;
}
