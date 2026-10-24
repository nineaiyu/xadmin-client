import { computed, type ComputedRef, type Ref } from "vue";
import type { ChatPeer, ChatRoomItem } from "@/api/chat";

/**
 * 输入区 `@` 成员联想（自 ChatWindow 抽出，行数门禁）。
 *
 * 触发口径：输入末尾的 `@片段`（AI 会话不触发——提示词里的 @ 无成员语义）；
 * 候选 = 会话成员预览 ∪ 在线联系人（群聊里离线/非最近成员也能被 @），按 pk
 * 去重后按片段过滤，最多 6 条。选中后替换末尾片段并补空格。
 */
export function useChatMention(deps: {
  draft: Ref<string>;
  room: ComputedRef<ChatRoomItem | null>;
  contacts: ComputedRef<ChatPeer[]>;
}) {
  const isAiRoom = computed(() => deps.room.value?.room_type === "ai");

  /** 输入末尾的 `@片段`：用于弹出在线成员联想 */
  const mentionQuery = computed(() => {
    if (isAiRoom.value) return null;
    const matched = /@([\p{L}\p{N}_\-]*)$/u.exec(deps.draft.value);
    return matched ? matched[1].toLowerCase() : null;
  });

  const mentionCandidates = computed(() => {
    if (mentionQuery.value === null) return [];
    // 群聊：成员预览并入候选（离线/非最近成员也能被 @），按 pk 去重
    const pool = new Map<number, ChatPeer>();
    (deps.room.value?.members ?? []).forEach(peer => pool.set(peer.pk, peer));
    deps.contacts.value.forEach(peer => pool.set(peer.pk, peer));
    return [...pool.values()]
      .filter(peer => {
        const name = (peer.username || "").toLowerCase();
        return !mentionQuery.value || name.includes(mentionQuery.value);
      })
      .slice(0, 6);
  });

  function insertMention(peer: ChatPeer) {
    deps.draft.value = deps.draft.value.replace(
      /@([\p{L}\p{N}_\-]*)$/u,
      `@${peer.username} `
    );
  }

  return { mentionCandidates, insertMention };
}
