import { h, type Component } from "vue";

import { addDialog, type DialogOptions } from "./index";
import { dialogSize } from "./size";

/**
 * 只读展示弹窗的统一装配（自各 `*Dialog.ts` 手写 9 字段样板收敛）。
 *
 * 覆盖口径：只读详情/预览类弹窗（hideFooter 常态）——需要表单提交/确认按钮的
 * 弹窗继续走 `useDialogForm`（提交链路语义不同，不应合并）。
 *
 * 返回 `DialogOptions`：调用方可再追加 `beforeSure` 等高级字段后 `addDialog`；
 * 默认已 `addDialog`，传 `defer: true` 时只构造不打开（供调用方定制后自行打开）。
 */
export type OpenDialogOptions = {
  title: string;
  /** 弹窗内容组件（props 直接透传） */
  component: Component;
  props?: Record<string, unknown>;
  /** 尺寸档位（dialogSize 口径）；显式 width 优先 */
  size?: "sm" | "md" | "lg" | "xl" | "xxl";
  width?: string;
  /** 只读弹窗默认隐藏底部按钮 */
  hideFooter?: boolean;
  /** 移动端全屏（含全屏切换按钮） */
  fullscreen?: boolean;
  /** 追加的 DialogOptions 字段（closeCallBack / beforeSure 等低频项） */
  extra?: Partial<DialogOptions>;
  /** 只构造 options 不打开（默认 false） */
  defer?: boolean;
};

export function openDialog({
  title,
  component,
  props,
  size = "md",
  width,
  hideFooter = false,
  fullscreen = false,
  extra,
  defer = false
}: OpenDialogOptions): DialogOptions {
  const options: DialogOptions = {
    title,
    width: width ?? dialogSize(size),
    draggable: true,
    closeOnClickModal: false,
    hideFooter,
    contentRenderer: () => h(component, props)
  };
  if (fullscreen) {
    options.fullscreen = true;
    options.fullscreenIcon = true;
  }
  Object.assign(options, extra ?? {});
  if (!defer) addDialog(options);
  return options;
}
