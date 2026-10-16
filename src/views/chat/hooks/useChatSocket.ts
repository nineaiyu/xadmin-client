import { ref } from "vue";
import type { Ref } from "vue";
import { ChatWebSocket, type WS } from "@/utils/websocket";
import {
  MessageAction,
  type ChatReactionUpdatePayload,
  type ChatRecallPayload,
  type ChatRoomMessage
} from "@/utils/websocket/protocol";
import type { ChatMessageItem } from "@/api/chat";
import type { RoomsState } from "./useRooms";
import { dispatchChatFrame } from "./chatFrames";

/**
 * 聊天室 WS 连接域（自 useChat 抽出）：自建 `ws/chat/` 连接（不与 user store 的
 * 全局通知连接争抢 onmessage）、帧分派（口径见 chatFrames.ts）与已读上报。
 * 消息集合与滚动状态由调用方持有，经 options 注入。
 */
export function useChatSocket({
  activeRoomId,
  me,
  roomState,
  upsertMessage,
  applyRecall,
  applyReactions,
  isMine,
  atBottom,
  pendingCount,
  scrollToBottom
}: {
  activeRoomId: Ref<number>;
  /** 当前登录用户（USERINFO 帧回写，气泡左右对齐依据） */
  me: Ref<{ pk: number; username: string; avatar: string }>;
  roomState: RoomsState;
  upsertMessage: (item: ChatRoomMessage) => boolean;
  applyRecall: (payload: ChatRecallPayload) => void;
  applyReactions: (payload: ChatReactionUpdatePayload) => void;
  isMine: (item: ChatMessageItem) => boolean;
  atBottom: Ref<boolean>;
  pendingCount: Ref<number>;
  scrollToBottom: () => void;
}) {
  const connected = ref(false);
  const socket = ref<WS>();

  function markRead(roomId: number) {
    // 本地未读先行清零；已读上报是"尽力而为"（服务端游标由后续上报收敛）：
    // 断连/重连窗口内 socket 不可用或发送抛错时静默跳过，不再裸 send
    roomState.clearUnread(roomId);
    if (!socket.value || !connected.value) return;
    try {
      socket.value.send(
        JSON.stringify({
          action: MessageAction.CHAT_READ,
          data: { room_id: roomId }
        })
      );
    } catch {
      // 与消息上行同口径：WS 竞态下的发送异常不外抛
    }
  }

  function connect() {
    socket.value?.close();
    const instance = new ChatWebSocket({
      openCallback: () => {
        connected.value = true;
        instance.onMessage(raw =>
          dispatchChatFrame(raw, {
            activeRoomId,
            me,
            roomState,
            upsertMessage,
            applyRecall,
            applyReactions,
            isMine,
            atBottom,
            pendingCount,
            scrollToBottom,
            markRead
          })
        );
        // 取当前登录用户主键（气泡左右对齐）；连接恢复后需重新拉取
        instance.send(JSON.stringify({ action: MessageAction.USERINFO }));
      },
      closeCallback: () => {
        connected.value = false;
      },
      errorCallback: () => {
        connected.value = false;
      }
    });
    socket.value = instance;
  }

  function disconnect() {
    socket.value?.close();
    socket.value = undefined;
    connected.value = false;
  }

  return { connected, socket, connect, disconnect, markRead };
}
