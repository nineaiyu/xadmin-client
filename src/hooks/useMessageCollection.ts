import { computed, type ComputedRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { groupByTime, type TimeGroupRow } from "@/utils/timeGroups";

/** upsert 口径：命中判定 + 命中后的合并（两条消息线各注入自己的对齐规则） */
export interface UpsertOptions<T> {
  /** 命中既有行的判定（按 id / 幂等键 / 乐观占位特征） */
  findMatch: (item: T, incoming: T) => boolean;
  /** 命中后的合并口径（服务端载荷赢） */
  merge: (existing: T, incoming: T) => T;
  /** 追加前的口径（如聊天室为广播消息补本地撤回窗口位） */
  prepareAppend?: (incoming: T) => T;
}

/**
 * 消息集合 upsert 共享口径（聊天室 / AI 控制台同一份）：按 findMatch 命中即
 * 原位覆盖并返回 false（广播回来的正式载荷覆盖乐观气泡只写一份），未命中
 * 追加尾部并返回 true（调用方据此联动贴底滚动 / 新消息计数）。
 */
export function upsertMessageItem<T>(
  messages: Ref<T[]>,
  incoming: T,
  options: UpsertOptions<T>
): boolean {
  const index = messages.value.findIndex(item =>
    options.findMatch(item, incoming)
  );
  if (index >= 0) {
    messages.value[index] = options.merge(messages.value[index], incoming);
    return false;
  }
  messages.value.push(
    options.prepareAppend ? options.prepareAppend(incoming) : incoming
  );
  return true;
}

/**
 * 消息流时间分组（聊天室 / AI 控制台共用）：首条 / 跨天 / 间隔超过阈值时插入
 * 分隔行（口径见 utils/timeGroups）；「昨天」标签取 chat 域既有词条，两条
 * 消息线共用同一文案。
 */
export function useMessageTimeGroups<
  T extends { id: number; created_time: string }
>(messages: Ref<T[]>): ComputedRef<TimeGroupRow<T>[]> {
  const { t } = useI18n();
  return computed(() => groupByTime(messages.value, t("chat.yesterday")));
}
