import { describe, expect, it } from "vitest";

import {
  canRemoveNoticeReadRow,
  isNoticeFamilyRow,
  noticeTypeCode,
  type NoticeReadRow
} from "../noticeReadRules";

const row = (noticeType: unknown): NoticeReadRow => ({
  pk: 1,
  notice_info: { pk: 10, title: "公告", notice_type: noticeType as never }
});

describe("通知接收行类型判定", () => {
  it.each([
    [1, true],
    [3, true],
    [4, true],
    [5, true],
    [0, false],
    [2, false],
    [9, false]
  ])("类型码 %s → 公告族 %s", (code, expected) => {
    expect(isNoticeFamilyRow(row({ value: code, label: "x" }))).toBe(expected);
  });

  it("兼容裸值形态（序列化器形态微调不丢判定）", () => {
    expect(noticeTypeCode(row(1))).toBe(1);
    expect(isNoticeFamilyRow(row("3"))).toBe(true);
  });

  it("缺失/非法类型码按用户族处理，不误删记录", () => {
    expect(noticeTypeCode({})).toBeUndefined();
    expect(isNoticeFamilyRow({})).toBe(false);
    expect(isNoticeFamilyRow(row("not-a-number"))).toBe(false);
  });

  it("移除入口仅对公告族且具备删除权限点开放", () => {
    expect(canRemoveNoticeReadRow(row(1), true)).toBe(true);
    expect(canRemoveNoticeReadRow(row(1), false)).toBe(false);
    expect(canRemoveNoticeReadRow(row(2), true)).toBe(false);
  });
});
