import { defineStore } from "pinia";
import { h, type VNode } from "vue";
import {
  MessageAction,
  isOutboundMessage,
  type PushMessagePayload
} from "@/utils/websocket/protocol";
import { PureWebSocket } from "@/utils/websocket";
import { notifyDesktop, stripHtml } from "@/utils/desktopNotify";
import {
  ElNotification,
  type NotificationOptions,
  type NotificationType
} from "element-plus";

import { router, store } from "../utils";

/**
 * 站内消息通知 store：消息推送 WebSocket 连接 + 未读计数 + 桌面/应用内通知分发。
 *
 * 从 user store 拆出（登录态与推送通道解耦）：user store 只保留身份信息，
 * 本 store 自持连接生命周期；登出经 messageHandler(onLogout) 注入的回调回连
 * user store，避免 store 间顶层循环依赖。
 */
export const useNoticeStore = defineStore("pure-notice", {
  state: () => ({
    /** 未读消息数量 */
    noticeCount: 0,
    /** 消息通知websocket */
    websocket: null as PureWebSocket | null
  }),
  actions: {
    SET_NOTICECOUNT(value: number) {
      this.noticeCount = Number(value);
    },
    INCR_NOTICECOUNT(value: number = 1) {
      this.noticeCount = (this.noticeCount ?? 0) + Number(value);
    },
    /** 关闭当前推送连接（主题切换重连 / 登出时调用） */
    disconnect() {
      this.websocket?.close();
      this.websocket = null;
    },
    /**
     * 建立消息推送通道并分派通知。
     *
     * :param identity: WS 连接标识（登录名，登录态归 user store，经参数注入）
     * :param onLogout: 服务端下发 logout 指令时执行（注入 user store 的登出，
     *                  避免本 store 反向依赖登录态模块）
     */
    messageHandler(identity: string, onLogout: () => void) {
      const onMessage = (raw: unknown) => {
        // 协议帧分派（protocol.ts）：仅处理 push_message 通知推送
        if (
          isOutboundMessage<PushMessagePayload>(raw, MessageAction.PUSH_MESSAGE)
        ) {
          const data = raw.data ?? {};
          let message: string | VNode | undefined = data?.message;
          // 桌面通知（二期）：聊天类（@提及/私聊）前台也弹，
          // 其余站内推送仅页面不可见时弹；点击行为与各分支的应用内通知一致
          const isChatPush =
            data?.message_type === "chat_message" ||
            data?.message_type === "chat_private" ||
            data?.message_type === "chat_group";
          notifyDesktop({
            type: isChatPush ? "chat" : "push",
            title: `${data?.notice_type?.label}-${data?.title}`,
            body: stripHtml(String(data?.message ?? "")),
            tag: data?.pk ? String(data.pk) : undefined,
            onClick: () => {
              if (isChatPush) {
                router.push({
                  name: "Chat",
                  query: data?.room_id ? { room: String(data.room_id) } : {}
                });
              } else {
                router.push({ name: "UserNotice", query: { pk: data?.pk } });
              }
            }
          });
          switch (data?.message_type) {
            case "notify_message":
              if (data?.notice_type?.value === 0) {
                // 统一按字符串测试（RegExp.test 本身会 ToString；显式归一消除类型歧义）
                const isHtml =
                  /<(?=.*? .*?\/ ?>|br|hr|input|!--|wbr)[a-z]+.*?>|<([a-z]+).*?<\/\1>/i.test(
                    String(message ?? "")
                  );
                if (!isHtml) {
                  message = h("i", { style: "color: teal" }, data?.message);
                }
              }
              const options: Partial<NotificationOptions> = {
                title: `${data?.notice_type?.label}-${data?.title}`,
                message: message ?? "",
                duration: 5000,
                dangerouslyUseHTMLString: true,
                type: (data?.level?.value
                  ?.replace("primary", "")
                  ?.replace("danger", "warning") ?? undefined) as
                  NotificationType | undefined,
                onClick: () => {
                  router.push({
                    name: "UserNotice",
                    query: { pk: data?.pk }
                  });
                }
              };
              ElNotification(options);
              this.INCR_NOTICECOUNT();
              break;
            case "chat_message":
              // @提及：点击跳聊天室并定位到该会话（服务端下发 room_id）
              ElNotification({
                title: `${data?.notice_type?.label}-${data?.title}`,
                message: h("i", { style: "color: teal" }, message),
                duration: 3000,
                onClick: () => {
                  router.push({
                    name: "Chat",
                    query: data?.room_id ? { room: String(data.room_id) } : {}
                  });
                }
              });
              break;
            case "chat_private":
            case "chat_group":
              // 私聊/群聊提醒（未开聊天室时推送）：点击直达该会话
              ElNotification({
                title: `${data?.notice_type?.label}-${data?.title}`,
                message: h("i", { style: "color: teal" }, message),
                duration: 5000,
                onClick: () => {
                  router.push({
                    name: "Chat",
                    query: data?.room_id ? { room: String(data.room_id) } : {}
                  });
                }
              });
              break;
            case "logout":
              onLogout();
              break;
            case "error":
              console.log(raw);
              break;
          }
        }
      };
      // 先关闭旧连接：重复调用 messageHandler（如重新拉取用户信息）时，
      // 避免叠加多个 WS 实例与其监听造成连接/内存泄漏
      this.websocket?.close();
      const socket = new PureWebSocket(identity, "xadmin", {
        openCallback: () => {
          socket.onMessage(data => {
            onMessage(data);
          });
        }
      });
      this.websocket = socket;
    }
  }
});

export function useNoticeStoreHook() {
  return useNoticeStore(store);
}
