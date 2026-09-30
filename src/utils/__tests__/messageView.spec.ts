import { describe, expect, it } from "vitest";
import type { AiActionDraft } from "@/api/ai/ai";
import { formatMessageTime, pickActionDrafts } from "../messageView";

const draft = (action: string): AiActionDraft => ({
  action,
  label: action,
  params: {},
  summary: "",
  requires_approval: false
});

describe("formatMessageTime", () => {
  it("按本地时区格式化为 HH:mm", () => {
    const date = new Date(2026, 0, 2, 9, 5);
    expect(formatMessageTime(date.toISOString())).toBe("09:05");
  });

  it("分钟补零", () => {
    const date = new Date(2026, 0, 2, 23, 7);
    expect(formatMessageTime(date.toISOString())).toBe("23:07");
  });

  it("无效时间返回空串", () => {
    expect(formatMessageTime("")).toBe("");
    expect(formatMessageTime(undefined)).toBe("");
    expect(formatMessageTime("not-a-date")).toBe("");
  });
});

describe("pickActionDrafts", () => {
  it("多步串联（action_drafts）优先", () => {
    const list = [draft("a"), draft("b")];
    expect(
      pickActionDrafts({ action_drafts: list, action_draft: draft("c") })
    ).toEqual(list);
  });

  it("兼容单动作契约（action_draft）", () => {
    expect(pickActionDrafts({ action_draft: draft("a") })).toEqual([
      draft("a")
    ]);
  });

  it("空草稿返回空数组", () => {
    expect(pickActionDrafts({})).toEqual([]);
    expect(pickActionDrafts({ action_drafts: [] })).toEqual([]);
    expect(pickActionDrafts(null)).toEqual([]);
    expect(pickActionDrafts(undefined)).toEqual([]);
  });
});
