import type { Component } from "vue";

/** 权限码：单个或多个（多个为「任一命中即显示」） */
export type TableActionAuth = string | string[];

/** 操作按钮提示 */
export interface TableActionTooltip {
  content: string;
  side?: "bottom" | "left" | "right" | "top";
}

/** 气泡确认框配置 */
export interface TableActionPopConfirm {
  /** 取消按钮文案 */
  cancelText?: string;
  /** 确认回调；未提供时回退到 action.onClick */
  confirm?: () => void;
  /** 确认按钮文案 */
  okText?: string;
  /** 提示标题（缺省用通用提示文案） */
  title?: string;
}

/** 点击回调参数 */
export interface TableActionClickParams {
  /** 当前行数据 */
  row: Record<string, unknown>;
  /** 被点击的操作项 */
  item: ActionItem;
  /** 行内 loading 句柄（异步操作时可读写） */
  loading: { value: boolean };
}

/** 单个操作项 */
export interface ActionItem {
  /** 权限码，配合 hasPermission 过滤 */
  auth?: TableActionAuth;
  /** 自定义类名 */
  class?: string;
  /** 危险操作（红色） */
  danger?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 图标（字符串 / 组件 / 图标数据对象，经 useRenderIcon 渲染） */
  icon?: Component | string | Record<string, unknown>;
  /** 是否显示：布尔或返回布尔的函数 */
  ifShow?: (() => boolean) | boolean;
  /** 唯一标识，点击回调可据此区分 */
  key?: number | string;
  /** 加载状态 */
  loading?: boolean;
  /** 点击回调（确认型操作在确认后触发） */
  onClick?: (params: TableActionClickParams) => void;
  /** 气泡确认框 */
  popConfirm?: TableActionPopConfirm;
  /** 尺寸 */
  size?: "" | "default" | "small" | "large";
  /** 文本（不传则为 icon-only 按钮，须配 tooltip 提供可访问名） */
  text?: string;
  /** 提示：字符串或配置对象 */
  tooltip?: string | TableActionTooltip;
}

/** 通用操作列组件 props */
export interface TableActionProps {
  /** 主操作按钮（行内展示） */
  actions?: ActionItem[];
  /** 「更多」下拉中的操作 */
  dropdownActions?: ActionItem[];
  /** 对齐方式 */
  align?: "center" | "end" | "start";
  /** 主操作之间是否显示分割线 */
  divider?: boolean;
  /** 权限判断函数，返回 false 则隐藏对应 auth 的操作（缺省用项目 hasAuth） */
  hasPermission?: (auth?: TableActionAuth) => boolean;
  /** 「更多」按钮文案（提供时显示在图标右侧） */
  moreText?: string;
  /** 表格行数据（透传给操作项回调） */
  row?: Record<string, unknown>;
  /** 按钮尺寸 */
  size?: "" | "default" | "small" | "large";
}
