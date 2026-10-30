import { computed, ref } from "vue";
import { describe, expect, it } from "vitest";

import { splitMentionSegments, useMentionSuggest } from "../mention";

/**
 * 审批讨论区 @ 提及联想与分段高亮单测。
 *
 * 正则口径与后端 MENTION_PATTERN 对齐（ASCII 用户名字符集，允许 . - _）：
 * 末尾 @片段 触发候选、@username 分段；空格终结本次提及（不再触发）。
 */

const candidates = [
  { pk: "1", username: "alice" },
  { pk: "2", username: "bob.dev" },
  { pk: "3", username: "carol-chen" }
];

function setup(draftText = "") {
  const draft = ref(draftText);
  const pool = computed(() => candidates);
  return { draft, ...useMentionSuggest({ draft, candidates: pool }) };
}

describe("useMentionSuggest", () => {
  it("末尾 @（空片段）触发全量候选；普通文本不触发", () => {
    const s1 = setup("看下这个 @");
    expect(s1.mentionQuery.value).toBe("");
    expect(s1.mentionCandidates.value.map(p => p.username)).toEqual([
      "alice",
      "bob.dev",
      "carol-chen"
    ]);
    const s2 = setup("没有触发词");
    expect(s2.mentionQuery.value).toBeNull();
    expect(s2.mentionCandidates.value).toEqual([]);
  });

  it("片段按 username 包含匹配过滤（大小写不敏感）", () => {
    const s = setup("提醒 @AL");
    expect(s.mentionCandidates.value.map(p => p.username)).toEqual(["alice"]);
    const dot = setup("提醒 @bob.");
    expect(dot.mentionCandidates.value.map(p => p.username)).toEqual([
      "bob.dev"
    ]);
  });

  it("选中后替换末尾片段并补空格，空格终结再触发", () => {
    const s = setup("请复核 @ali");
    s.insertMention(candidates[0]);
    expect(s.draft.value).toBe("请复核 @alice ");
    const after = setup("请 @alice ");
    expect(after.mentionQuery.value).toBeNull();
  });

  it("非末尾的历史 @ 不触发联想", () => {
    const s = setup("@alice 帮我看下这个");
    expect(s.mentionQuery.value).toBeNull();
    expect(s.mentionCandidates.value).toEqual([]);
  });

  it("中文字符不在用户名字符集内，触发在中文后照常判定", () => {
    const s = setup("处理一下@bo");
    expect(s.mentionQuery.value).toBe("bo");
    expect(s.mentionCandidates.value.map(p => p.username)).toEqual(["bob.dev"]);
  });
});

describe("splitMentionSegments", () => {
  it("按 @用户名 分段：提及片段标记，普通文本原样", () => {
    expect(splitMentionSegments("@alice 请复核，@bob.dev 知悉")).toEqual([
      { text: "@alice", mention: true },
      { text: " 请复核，", mention: false },
      { text: "@bob.dev", mention: true },
      { text: " 知悉", mention: false }
    ]);
  });

  it("无提及与空串：单段 / 空数组", () => {
    expect(splitMentionSegments("普通评论")).toEqual([
      { text: "普通评论", mention: false }
    ]);
    expect(splitMentionSegments("")).toEqual([]);
  });

  it("行内 @（非行首）与邮件形态边界：紧跟词字符的 @ 不拆分段", () => {
    // a@b 中的 @ 前是词字符，MENTION_GLOBAL 仍会匹配 @b——与后端解析口径一致
    expect(splitMentionSegments("邮箱 a@b.com")).toEqual([
      { text: "邮箱 a", mention: false },
      { text: "@b.com", mention: true }
    ]);
  });
});
