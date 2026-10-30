import { defineStore } from "pinia";
import { h, type VNode } from "vue";
import { isSuccess } from "@/api/types";
import {
  MessageAction,
  isOutboundMessage,
  type PushMessagePayload
} from "@/utils/websocket/protocol";
import { PureWebSocket } from "@/utils/websocket";
import { notifyDesktop, stripHtml } from "@/utils/desktopNotify";
import { sanitizeHtml } from "@/utils/sanitize";
import { isKioskMeta } from "@/utils/kiosk";
import { resolveMessageFormat } from "@/utils/noticeFormat";
import { openNoticeDetailDialog } from "@/components/ReNoticeShow/noticeDetailDialog";
import { ElNotification } from "element-plus/es/components/notification/index.mjs";
import type { NotificationOptions, NotificationType } from "element-plus";

import { router } from "@/router/router";
import { store } from "../utils";

/**
 * Markdown → 纯文本预览。
 *
 * 动态引入：markdown-it 约 40KB（gzip），本 store 属首屏闭包，静态引入会把整个
 * 渲染器带进首屏；只有真正收到 Markdown 公告推送时才加载（模块 Promise 缓存，
 * 后续推送不再重复加载）。
 */
let markdownPreviewModule: Promise<typeof import("@/utils/markdown")> | null =
  null;

async function markdownPreviewText(content: string): Promise<string> {
  markdownPreviewModule ??= import("@/utils/markdown");
  const { markdownToPlainText } = await markdownPreviewModule;
  return markdownToPlainText(content);
}

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
     * 站内信点击：就地弹出通知详情弹窗（与顶栏铃铛未读点击同形态，不跳转页面），
     * 并标记该条已读、同步未读角标。
     */
    async openNoticeDetail(data: PushMessagePayload) {
      openNoticeDetailDialog({ ...data });
      const pk = data?.pk;
      if (pk == null) return;
      // 打开即读（与铃铛一致）；业务码失败静默，角标由后续刷新纠正。
      // api 层动态引入：本 store 顶层静态引用走 http 链路的 api 模块会形成模块环
      // （api/base → utils/http → store/user → store/notice → api/user/notice）
      const { userNoticeReadApi } = await import("@/api/user/notice");
      userNoticeReadApi
        .batchRead({ pks: [pk] })
        .then(res => {
          if (isSuccess(res)) {
            this.SET_NOTICECOUNT(
              Math.max(0, Number(this.noticeCount ?? 0) - 1)
            );
          }
        })
        .catch(() => undefined);
    },
    /**
     * 建立消息推送通道并分派通知。
     *
     * :param identity: WS 连接标识（登录名，登录态归 user store，经参数注入）
     * :param onLogout: 服务端下发 logout 指令时执行（注入 user store 的登出，
     *                  避免本 store 反向依赖登录态模块）
     */
    messageHandler(identity: string, onLogout: () => void) {
      const onMessage = async (raw: unknown) => {
        // 协议帧分派（protocol.ts）：仅处理 push_message 通知推送
        if (
          isOutboundMessage<PushMessagePayload>(raw, MessageAction.PUSH_MESSAGE)
        ) {
          const data = raw.data ?? {};
          // 展板态（大屏投屏等全屏展示页）不弹浮层：公告横幅会直接盖住画面。
          // 未读计数照常累加、登出指令照常执行（只屏蔽「弹窗」这一层）。
          const quiet = isKioskMeta(router.currentRoute.value?.meta);
          let message: string | VNode | undefined = data?.message;
          // 推送预览只走纯文本：Markdown 先渲染再取文本（否则通知里出现 ** / #），
          // HTML 保持既有剥标签口径
          const isMarkdownMessage =
            resolveMessageFormat(data?.message_format) === "markdown";
          const previewText = isMarkdownMessage
            ? await markdownPreviewText(String(data?.message ?? ""))
            : stripHtml(String(data?.message ?? ""));
          // 桌面通知：聊天类（@提及/私聊）前台也弹，
          // 其余站内推送仅页面不可见时弹；点击行为与应用内通知一致
          // （聊天类直达会话，站内信就地弹出详情弹窗）
          const isChatPush =
            data?.message_type === "chat_message" ||
            data?.message_type === "chat_private" ||
            data?.message_type === "chat_group";
          if (!quiet) {
            notifyDesktop({
              type: isChatPush ? "chat" : "push",
              title: `${data?.notice_type?.label}-${data?.title}`,
              body: previewText,
              tag: data?.pk ? String(data.pk) : undefined,
              onClick: () => {
                if (isChatPush) {
                  router.push({
                    name: "Chat",
                    query: data?.room_id ? { room: String(data.room_id) } : {}
                  });
                } else {
                  this.openNoticeDetail(data);
                }
              }
            });
          }
          switch (data?.message_type) {
            case "notify_message":
              if (isMarkdownMessage) {
                // Markdown 公告：预览用纯文本，禁用 HTML 通道（渲染结果不塞进通知）
                message = previewText;
              } else {
                // 统一按字符串测试（RegExp.test 本身会 ToString；显式归一消除类型歧义）
                const raw = String(message ?? "");
                const isHtml =
                  /<(?=.*? .*?\/ ?>|br|hr|input|!--|wbr)[a-z]+.*?>|<([a-z]+).*?<\/\1>/i.test(
                    raw
                  );
                if (!isHtml) {
                  message = h(
                    "i",
                    { style: "color: var(--el-color-primary)" },
                    data?.message
                  );
                } else {
                  // 任意公告类型走 dangerouslyUseHTMLString 前都必须净化：
                  // notice_type 不是安全边界（历史脏数据/新增类型同样可能带 HTML）。
                  message = sanitizeHtml(raw);
                }
              }
              const options: Partial<NotificationOptions> = {
                title: `${data?.notice_type?.label}-${data?.title}`,
                message: message ?? "",
                duration: 5000,
                dangerouslyUseHTMLString: !isMarkdownMessage,
                type: (data?.level?.value
                  ?.replace("primary", "")
                  ?.replace("danger", "warning") ?? undefined) as
                  NotificationType | undefined,
                // 点击就地弹出通知详情弹窗（与顶栏铃铛一致），不再跳转「我的通知」页
                onClick: () => this.openNoticeDetail(data)
              };
              if (!quiet) ElNotification(options);
              this.INCR_NOTICECOUNT();
              break;
            case "chat_message":
              // @提及：点击跳聊天室并定位到该会话（服务端下发 room_id）
              if (!quiet)
                ElNotification({
                  title: `${data?.notice_type?.label}-${data?.title}`,
                  message: h(
                    "i",
                    { style: "color: var(--el-color-primary)" },
                    message
                  ),
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
              if (!quiet)
                ElNotification({
                  title: `${data?.notice_type?.label}-${data?.title}`,
                  message: h(
                    "i",
                    { style: "color: var(--el-color-primary)" },
                    message
                  ),
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
              // 服务端下发的错误事件：不入通知浮层（防刷屏），但必须以 warn
              // 落控制台——此前 console.log 级别的吞错在排查时形同没有日志
              console.warn("[notice] WebSocket error message:", raw);
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
