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

/** 中断固化消息与服务端 partial 的合并窗口（时钟偏差/延迟容忍） */
const PARTIAL_MERGE_WINDOW_MS = 5 * 60 * 1000;

/**
 * 本地中断消息（负 id）与服务端载荷是否同一条：
 * - 同角色、同入口；
 * - 内容相等或互为前缀（中断时本地累计增量通常就是服务端落库内容的前缀；
 *   掩码/尾停可能让某一侧略长）；
 * - 时间接近（防止把同一入口历史里相似回答误合并）。
 */
function isPartialCounterpart(
  local: AiConsoleMessage,
  incoming: AiConsoleMessage
): boolean {
  if (local.id >= 0 || local.role !== incoming.role) return false;
  if (local.feature !== incoming.feature) return false;
  const left = local.content ?? "";
  const right = incoming.content ?? "";
  if (!left || !right) return false;
  if (left !== right && !left.startsWith(right) && !right.startsWith(left)) {
    return false;
  }
  const leftAt = Date.parse(local.created_time);
  const rightAt = Date.parse(incoming.created_time);
  return (
    !Number.isFinite(leftAt) ||
    !Number.isFinite(rightAt) ||
    Math.abs(rightAt - leftAt) <= PARTIAL_MERGE_WINDOW_MS
  );
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
        // 乐观占位（负 id）按「同角色 + 同内容」对齐为服务端载荷；
        // 中断固化的助手消息内容可能与服务端 partial 不完全一致（尾停/掩码），
        // 按「同入口 + 互为前缀 + 时间邻近」宽容对齐，避免刷新后出现两条。
        (item.id < 0 &&
          (item.role === "user"
            ? item.role === incomingItem.role &&
              item.content === incomingItem.content
            : isPartialCounterpart(item, incomingItem))),
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

  /** 响应头前失败（服务端未落库）：移除乐观占位（从末尾找，避免重复提问时误删更早一条） */
  function removeOptimistic(content: string) {
    for (let index = messages.value.length - 1; index >= 0; index -= 1) {
      const item = messages.value[index];
      if (item.id < 0 && item.role === "user" && item.content === content) {
        messages.value.splice(index, 1);
        return;
      }
    }
  }

  return {
    messages,
    messageGroups,
    upsertMessage,
    pushOptimistic,
    removeOptimistic
  };
}
