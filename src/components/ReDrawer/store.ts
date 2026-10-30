import { createOverlayStore } from "@/components/overlay/store";
import type { ArgsType, DrawerOptions, DrawerPayloadApi } from "./type";

/**
 * 抽屉队列：入队/uid/延迟/载荷通道/关闭清理由 `overlay/store` 统一实现，
 * 本文件只保留抽屉的导出名与类型。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const overlay = createOverlayStore<DrawerOptions<any>>();

export const drawerStore = overlay.store;
export const getDrawerUid = overlay.getUid;
export const closeDrawer = overlay.close;
export const updateDrawer = overlay.update;
export const closeAllDrawer = overlay.closeAll;

/** 载荷通道泛型由调用方决定（工厂的 TOptions 不携带 payload 泛型） */
export function addDrawer<T>(
  options: DrawerOptions<T> & { payload: T }
): DrawerPayloadApi<T>;
export function addDrawer(options: DrawerOptions): void;
export function addDrawer(options: DrawerOptions) {
  return overlay.add(options as DrawerOptions & { payload: unknown }) as
    DrawerPayloadApi<unknown> | undefined;
}

export type { ArgsType, DrawerOptions };
