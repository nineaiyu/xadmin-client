import { describe, expect, it } from "vitest";

import {
  NOTICE_TARGET_AUTH,
  noticeTypeOptionLocked,
  parseNoticeUserParam
} from "../noticeFormRules";
import { NoticeChoices } from "@/views/system/constants";

describe("noticeTypeOptionLocked", () => {
  it("locks the announcement (SYSTEM) option unconditionally", () => {
    expect(noticeTypeOptionLocked(NoticeChoices.SYSTEM, true)).toBe(true);
    expect(noticeTypeOptionLocked(NoticeChoices.SYSTEM, false)).toBe(true);
  });

  it("locks the plain notice (NOTICE) option without publish permission", () => {
    expect(noticeTypeOptionLocked(NoticeChoices.NOTICE, false)).toBe(true);
    expect(noticeTypeOptionLocked(NoticeChoices.NOTICE, true)).toBe(false);
  });

  it("never locks other types (disabled state left untouched)", () => {
    expect(noticeTypeOptionLocked(NoticeChoices.USER, false)).toBe(false);
    expect(noticeTypeOptionLocked(NoticeChoices.DEPT, false)).toBe(false);
    expect(noticeTypeOptionLocked(undefined, false)).toBe(false);
  });
});

describe("parseNoticeUserParam", () => {
  it("parses valid JSON payloads", () => {
    expect(parseNoticeUserParam('{"id":1}')).toEqual({
      ok: true,
      value: { id: 1 }
    });
    expect(parseNoticeUserParam("42")).toEqual({ ok: true, value: 42 });
  });

  it("reports failure for invalid or missing JSON instead of throwing", () => {
    expect(parseNoticeUserParam("{oops")).toEqual({ ok: false });
    expect(parseNoticeUserParam(undefined)).toEqual({ ok: false });
    expect(parseNoticeUserParam("")).toEqual({ ok: false });
  });
});

describe("NOTICE_TARGET_AUTH", () => {
  it("binds each target column to its search permission code", () => {
    expect(NOTICE_TARGET_AUTH[NoticeChoices.USER]).toBe("list:SearchUser");
    expect(NOTICE_TARGET_AUTH[NoticeChoices.DEPT]).toBe("list:SearchDept");
    expect(NOTICE_TARGET_AUTH[NoticeChoices.ROLE]).toBe("list:SearchRole");
    expect(NOTICE_TARGET_AUTH[NoticeChoices.POST]).toBe("list:SearchPost");
  });
});
