import { computed, type ComputedRef, type Ref } from "vue";

/**
 * 审批讨论区 @ 提及联想与高亮分段。
 *
 * 正则口径与后端 `MENTION_PATTERN = r"@([\w.\-]+)"` 对齐（ASCII 用户名字符集，
 * 允许 `.` `-` `_`）：末尾 `@片段` 触发候选，`@用户名` 全局分段高亮。
 * 候选源由调用方提供（讨论区 = 实例参与人），本模块只做过滤与插入。
 */

export type MentionUser = { pk: string; username: string };

export const MENTION_TOKEN = /@([\w.-]*)$/;
const MENTION_GLOBAL = /(@[\w.-]+)/g;
const CANDIDATE_LIMIT = 6;

export function useMentionSuggest(deps: {
  draft: Ref<string>;
  candidates: ComputedRef<MentionUser[]> | Ref<MentionUser[]>;
}) {
  /** 输入末尾的 `@片段`（含空片段——输入 @ 即出全量候选）；无触发为 null */
  const mentionQuery = computed(() => {
    const matched = MENTION_TOKEN.exec(deps.draft.value);
    return matched ? matched[1].toLowerCase() : null;
  });

  /** 候选 = 候选源按片段过滤（username 包含匹配，大小写不敏感），最多 6 条 */
  const mentionCandidates = computed(() => {
    if (mentionQuery.value === null) return [];
    const query = mentionQuery.value;
    return deps.candidates.value
      .filter(peer => !query || peer.username.toLowerCase().includes(query))
      .slice(0, CANDIDATE_LIMIT);
  });

  /** 选中后替换末尾片段并补空格（空格终结本次提及，后端解析同口径） */
  function insertMention(peer: MentionUser) {
    deps.draft.value = deps.draft.value.replace(
      MENTION_TOKEN,
      `@${peer.username} `
    );
  }

  return { mentionQuery, mentionCandidates, insertMention };
}

/** 评论正文按 `@用户名` 分段（mention 片段着色渲染，文本节点直出——不用 v-html） */
export function splitMentionSegments(content: string) {
  const segments: Array<{ text: string; mention: boolean }> = [];
  let cursor = 0;
  for (const matched of content.matchAll(MENTION_GLOBAL)) {
    const index = matched.index ?? 0;
    if (index > cursor) {
      segments.push({ text: content.slice(cursor, index), mention: false });
    }
    segments.push({ text: matched[0], mention: true });
    cursor = index + matched[0].length;
  }
  if (cursor < content.length) {
    segments.push({ text: content.slice(cursor), mention: false });
  }
  return segments;
}
