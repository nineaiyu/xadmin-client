import type { Component } from "vue";

/** 弹层（对话框 / 抽屉）共享类型：与具体 Element Plus 组件无关。 */

export type OverlayArgs = {
  /** `cancel` 点击取消按钮、`sure` 点击确定按钮、`close` 点击关闭/遮罩/ESC */
  command: "cancel" | "sure" | "close";
};

export type OverlayDoneFn = (cancel?: boolean) => void;

export type OverlayEventType =
  "open" | "close" | "openAutoFocus" | "closeAutoFocus" | "fullscreenCallBack";

type OverlayButtonType =
  "primary" | "success" | "warning" | "danger" | "info" | "text";

/** EP `el-popconfirm` 透传配置（ReDialog / ReDrawer 组件侧的 Popconfirm 同构） */
export interface OverlayPopconfirm {
  /** 标题 */
  title?: string;
  /** 确定按钮文字 */
  confirmButtonText?: string;
  /** 取消按钮文字 */
  cancelButtonText?: string;
  /** 确定按钮类型，默认 `primary` */
  confirmButtonType?: OverlayButtonType;
  /** 取消按钮类型，默认 `text` */
  cancelButtonType?: OverlayButtonType;
  /** 自定义图标，默认 `QuestionFilled` */
  icon?: string | Component;
  /** `Icon` 颜色，默认 `#f90` */
  iconColor?: string;
  /** 是否隐藏 `Icon`，默认 `false` */
  hideIcon?: boolean;
  /** 关闭时的延迟，默认 `200` */
  hideAfter?: number;
  /** 是否将 `popover` 的下拉列表插入至 `body`，默认 `true` */
  teleported?: boolean;
  /** 长时间不触发且 `persistent=false` 时 popover 会被删除，默认 `false` */
  persistent?: boolean;
  /** 弹层宽度，最小宽度 `150px`，默认 `150` */
  width?: string | number;
}

/**
 * 共享按钮配置：ReDialog / ReDrawer 各自 `ButtonProps` 的公共子集，
 * 未列出的 EP 按钮属性由组件侧类型约束，共享层只消费这里列出的字段。
 * `btnClick` 的 ctx 形状由组件侧决定（ReDialog 传 `{ dialog }`、ReDrawer 传
 * `{ drawer }`），共享层经 `dialogOrDrawer` 统一取出 options / index，故默认
 * `unknown`；声明为方法签名以获得双变参数检查，组件侧自定义的 ctx 形状可直接赋值。
 */
export interface OverlayButtonProps<TCtx = unknown> {
  /** 按钮文字 */
  label: string;
  /** 稳定标识：默认按钮组携带（`cancel` / `sure`），footer loading 按此判定 */
  code?: string;
  /** 按钮尺寸 */
  size?: "large" | "default" | "small";
  /** 按钮类型 */
  type?: "primary" | "success" | "warning" | "danger" | "info";
  /** 是否为文字按钮 */
  text?: boolean;
  /** 是否显示文字按钮背景颜色 */
  bg?: boolean;
  /** 是否为加载中状态 */
  loading?: boolean;
  /** 按钮是否为禁用状态 */
  disabled?: boolean;
  /** 图标组件 */
  icon?: string | Component;
  /** 气泡确认框配置（透传 `el-popconfirm`） */
  popconfirm?: OverlayPopconfirm;
  /** @deprecated 拼写历史名（EP 官方为 popconfirm）；仅 ReDrawer 兼容读取 */
  popConfirm?: OverlayPopconfirm;
  /** 点击按钮后触发的回调 */
  btnClick?(ctx: TCtx): void;
}

/**
 * 弹层选项的公共面：两个组件真正共用的字段子集。
 * 泛型参数为选项自身类型（`DialogOptions` / `DrawerOptions`），
 * 回调中的 `options` 即以该类型回传，共享层无需退化为宽泛类型。
 */
export interface OverlayBaseOptions<TOptions = Record<string, unknown>> {
  visible?: boolean;
  payload?: unknown;
  openDelay?: number;
  closeDelay?: number;

  closeCallBack?: (args: {
    options: TOptions;
    index: number;
    args?: OverlayArgs;
  }) => void;

  beforeCancel?: (
    done: OverlayDoneFn,
    ctx: { options: TOptions; index: number }
  ) => void;

  beforeSure?: (
    done: OverlayDoneFn,
    ctx: { options: TOptions; index: number; closeLoading: () => void }
  ) => void;
  beforeClose?: (done: OverlayDoneFn) => void;
  sureBtnLoading?: boolean;
  sureBtnText?: string;
  popconfirm?: OverlayPopconfirm;
  /** @deprecated 拼写历史名（EP 官方为 popconfirm）；仅 ReDrawer 兼容读取 */
  popConfirm?: OverlayPopconfirm;
  hideFooter?: boolean;
  /** 自定义按钮：组件侧 `ButtonProps[]` 结构兼容（见 OverlayButtonProps） */
  footerButtons?: OverlayButtonProps[];
}
