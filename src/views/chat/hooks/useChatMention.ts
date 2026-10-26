import { computed, ref, watch, type ComputedRef, type Ref } from "vue";
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

  /** 键盘导航当前项；Esc 关闭后本次输入不再弹出（继续输入即恢复） */
  const mentionIndex = ref(0);
  const mentionDismissed = ref(false);
  watch(deps.draft, () => {
    mentionDismissed.value = false;
  });

  const mentionCandidates = computed(() => {
    if (mentionDismissed.value || mentionQuery.value === null) return [];
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

  watch(mentionCandidates, () => {
    mentionIndex.value = 0;
  });

  function insertMention(peer: ChatPeer) {
    deps.draft.value = deps.draft.value.replace(
      /@([\p{L}\p{N}_\-]*)$/u,
      `@${peer.username} `
    );
  }

  /** 上下键移动候选高亮（循环） */
  function moveMention(step: number) {
    const count = mentionCandidates.value.length;
    if (!count) return;
    mentionIndex.value = (mentionIndex.value + step + count) % count;
  }

  /** Enter 选中当前候选；返回是否消费了事件 */
  function chooseMention() {
    const peer = mentionCandidates.value[mentionIndex.value];
    if (!peer) return false;
    insertMention(peer);
    return true;
  }

  function dismissMentions() {
    mentionDismissed.value = true;
  }

  return {
    mentionCandidates,
    mentionIndex,
    insertMention,
    moveMention,
    chooseMention,
    dismissMentions
  };
}
