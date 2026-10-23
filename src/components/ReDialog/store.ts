import { createOverlayStore } from "@/components/overlay/store";
import type { ArgsType, DialogOptions, DialogPayloadApi } from "./type";

/**
 * 对话框队列：入队/uid/延迟/载荷通道/关闭清理由 `overlay/store` 统一实现，
 * 本文件只保留对话框的导出名与类型。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const overlay = createOverlayStore<DialogOptions<any>>();

export const dialogStore = overlay.store;
export const getDialogUid = overlay.getUid;
export const closeDialog = overlay.close;
export const updateDialog = overlay.update;
export const closeAllDialog = overlay.closeAll;

/** 载荷通道泛型由调用方决定（工厂的 TOptions 不携带 payload 泛型） */
export function addDialog<T>(
  options: DialogOptions<T> & { payload: T }
): DialogPayloadApi<T>;
export function addDialog(options: DialogOptions): void;
export function addDialog(options: DialogOptions) {
  return overlay.add(options as DialogOptions & { payload: unknown }) as
    DialogPayloadApi<unknown> | undefined;
}

export type { ArgsType, DialogOptions };
