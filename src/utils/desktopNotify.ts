import { storageLocal } from "@pureadmin/utils";

import { responsiveStorageNameSpace } from "@/config";

/**
 * 桌面通知（Notification API，二期）。
 *
 * 覆盖两类来源，均来自全局通道 push_message 帧（store/modules/user.ts::messageHandler）：
 * - 聊天室实时消息（@提及 / 私聊提醒）：页面在前台也弹（微信式高信号）；
 * - 站内信推送（审批/公告等）：仅页面不可见时弹（前台有应用内通知，避免重复打扰）。
 *
 * 开关持久化在 localStorage（带项目命名空间）；权限在开启时按需申请。
 */

const STORAGE_KEY = "desktop-notify-enabled";

export type DesktopNotifyType = "chat" | "push";

export function isDesktopNotifySupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function desktopNotifyEnabled(): boolean {
  if (!isDesktopNotifySupported()) return false;
  return (
    storageLocal().getItem<boolean>(
      `${responsiveStorageNameSpace()}${STORAGE_KEY}`
    ) === true
  );
}

/** 开启：按需申请权限，返回是否成功开启（拒绝/不支持为 false） */
export async function enableDesktopNotify(): Promise<boolean> {
  if (!isDesktopNotifySupported()) return false;
  if (Notification.permission !== "granted") {
    try {
      const result = await Notification.requestPermission();
      if (result !== "granted") return false;
    } catch {
      return false;
    }
  }
  storageLocal().setItem(`${responsiveStorageNameSpace()}${STORAGE_KEY}`, true);
  return true;
}

export function disableDesktopNotify(): void {
  storageLocal().removeItem(`${responsiveStorageNameSpace()}${STORAGE_KEY}`);
}

/** 决策函数（单测钉口径）：是否应该弹桌面通知 */
export function shouldNotifyDesktop(
  type: DesktopNotifyType,
  documentHidden: boolean
): boolean {
  if (!isDesktopNotifySupported() || !desktopNotifyEnabled()) return false;
  if (Notification.permission !== "granted") return false;
  return type === "chat" ? true : documentHidden;
}

export interface DesktopNotifyPayload {
  type: DesktopNotifyType;
  title: string;
  body: string;
  /** 点击通知：聚焦窗口后执行（路由跳转由调用方传入） */
  onClick?: () => void;
  /** 同 tag 的通知会被系统合并替换（避免同一会话刷屏） */
  tag?: string;
}

/** 弹桌面通知；返回是否真正弹出（未开启/未授权/不支持为 false） */
export function notifyDesktop(payload: DesktopNotifyPayload): boolean {
  if (!shouldNotifyDesktop(payload.type, document.hidden)) return false;
  try {
    const notification = new Notification(payload.title, {
      body: payload.body,
      tag: payload.tag
    });
    notification.onclick = () => {
      window.focus();
      payload.onClick?.();
      notification.close();
    };
    return true;
  } catch {
    // 部分环境（移动端/无头）构造即抛错：静默降级为应用内通知
    return false;
  }
}

/** 桌面通知正文必须是纯文本（推送正文可能携带 HTML 片段） */
export function stripHtml(text: string): string {
  return String(text ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
