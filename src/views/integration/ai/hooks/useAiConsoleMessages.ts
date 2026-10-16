import { ref } from "vue";
import type { Ref } from "vue";
import type { AiConsoleFeature, AiConsoleMessage } from "@/api/ai/ai";
import {
  upsertMessageItem,
  useMessageTimeGroups
} from "@/hooks/useMessageCollection";

/** 服务端消息载荷校验（history / meta / done / error 共用） */
export function toIncoming(payload: unknown): AiConsoleMessage | null {
  const row = payload as AiConsoleMessage | undefined;
  return row && row.role && typeof row.content === "string" ? row : null;
}

/**
 * AI 控制台消息集合域：持久化消息流 + 乐观上屏对齐。upsert 骨架与时间分组
 * 收敛于共享层（聊天室同一套口径）；本域注入「同角色 + 同内容」的乐观占位
 * 对齐规则，追加行为与滚动域联动（离底自动跟随，否则计新消息数）。
 */
export function useAiConsoleMessages({
  feature,
  atBottom,
  pendingCount,
  scrollToBottom
}: {
  feature: Ref<AiConsoleFeature>;
  atBottom: Ref<boolean>;
  pendingCount: Ref<number>;
  scrollToBottom: () => void;
}) {
  const messages = ref<AiConsoleMessage[]>([]);

  /** 时间分隔：首条 / 跨天 / 间隔超过阈值时插入分组标签（口径见 utils/timeGroups） */
  const messageGroups = useMessageTimeGroups(messages);

  function upsertMessage(incoming: AiConsoleMessage) {
    const appended = upsertMessageItem(messages, incoming, {
      findMatch: (item, incomingItem) =>
        item.id === incomingItem.id ||
        // 乐观占位（负 id）按「同角色 + 同内容」对齐为服务端载荷
        (item.id < 0 &&
          item.role === incomingItem.role &&
          item.content === incomingItem.content),
      merge: (existing, incomingItem) => ({ ...existing, ...incomingItem })
    });
    if (appended) {
      if (atBottom.value) scrollToBottom();
      else pendingCount.value += 1;
    }
  }

  function pushOptimistic(content: string) {
    messages.value.push({
      id: -Date.now(),
      feature: feature.value,
      role: "user",
      content,
      reasoning: "",
      extra: {},
      created_time: new Date().toISOString()
    });
  }

  /** 响应头前失败（服务端未落库）：移除乐观占位 */
  function removeOptimistic(content: string) {
    const index = messages.value.findIndex(
      item => item.id < 0 && item.role === "user" && item.content === content
    );
    if (index >= 0) messages.value.splice(index, 1);
  }

  return {
    messages,
    messageGroups,
    upsertMessage,
    pushOptimistic,
    removeOptimistic
  };
}
