import { onUnmounted, watch } from "vue";
import type { Ref } from "vue";

/**
 * 聊天室生命周期装配（自 useChat 抽出）：会话切换链路（中断流 → 拉历史 →
 * 上报已读，次序由用例守护）与卸载清理（中断流 / 断开 WS / 释放巡检定时器）。
 */
export function useChatLifecycle(deps: {
  activeRoomId: Ref<number>;
  abortStream: () => void;
  loadHistory: (roomId: number) => Promise<unknown> | void;
  markRead: (roomId: number) => void;
  disconnect: () => void;
  dispose: () => void;
}) {
  // 切换会话：中断流 + 拉历史 + 清未读（本地红点 + 服务端游标）
  watch(
    deps.activeRoomId,
    async roomId => {
      deps.abortStream();
      if (!roomId) return;
      await deps.loadHistory(roomId);
      deps.markRead(roomId);
    },
    { immediate: true }
  );

  onUnmounted(() => {
    deps.abortStream();
    deps.disconnect();
    // 停掉消息集合的撤回窗口巡检定时器
    deps.dispose();
  });
}
