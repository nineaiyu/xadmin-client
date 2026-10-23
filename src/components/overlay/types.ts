/** 弹层（对话框 / 抽屉）共享类型：与具体 Element Plus 组件无关。 */

export type OverlayArgs = {
  /** `cancel` 点击取消按钮、`sure` 点击确定按钮、`close` 点击关闭/遮罩/ESC */
  command: "cancel" | "sure" | "close";
};

export type OverlayDoneFn = (cancel?: boolean) => void;

export type OverlayEventType =
  "open" | "close" | "openAutoFocus" | "closeAutoFocus" | "fullscreenCallBack";

/** 共享按钮配置（ReDialog / ReDrawer 的 ButtonProps 结构兼容） */
export interface OverlayButtonProps {
  label: string;
  code?: string;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  popconfirm?: any;
  popConfirm?: any;
  btnClick?: (ctx: any) => void;
  [key: string]: any;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** 弹层选项的公共面：两个组件真正共用的字段子集 */
export interface OverlayBaseOptions {
  visible?: boolean;
  payload?: unknown;
  openDelay?: number;
  closeDelay?: number;
  // 回调参数使用 any：DialogOptions / DrawerOptions 的具体参数类型不同，
  // 共享层只关心「拿到 options/index」，由调用方保证类型。

  closeCallBack?: (args: {
    options: any;
    index: number;
    args?: OverlayArgs;
  }) => void;

  beforeCancel?: (
    done: OverlayDoneFn,
    ctx: { options: any; index: number }
  ) => void;

  beforeSure?: (
    done: OverlayDoneFn,
    ctx: { options: any; index: number; closeLoading: () => void }
  ) => void;
  beforeClose?: (done: OverlayDoneFn) => void;
  sureBtnLoading?: boolean;
  sureBtnText?: string;
  popconfirm?: unknown;
  popConfirm?: unknown;
  hideFooter?: boolean;
  // 自定义按钮由各组件原样透传，共享层不约束其具体字段
  footerButtons?: unknown[];
}
/* eslint-enable @typescript-eslint/no-explicit-any */
