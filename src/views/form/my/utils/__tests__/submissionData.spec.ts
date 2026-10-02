import { describe, expect, it } from "vitest";

import { submissionDataText } from "../submissionData";

describe("submissionDataText", () => {
  it("returns dash for empty data", () => {
    expect(submissionDataText({})).toBe("-");
    expect(submissionDataText(undefined as never)).toBe("-");
  });

  it("joins scalar entries with pipe separator", () => {
    expect(submissionDataText({ 姓名: "张三", 数量: 3 })).toBe(
      "姓名: 张三 | 数量: 3"
    );
  });

  it("serializes object values as JSON instead of [object Object]", () => {
    expect(submissionDataText({ 附件: [{ name: "a.pdf" }] })).toBe(
      '附件: [{"name":"a.pdf"}]'
    );
    expect(submissionDataText({ 日期: ["2026-01-01", "2026-01-31"] })).toBe(
      '日期: ["2026-01-01","2026-01-31"]'
    );
  });

  it("renders null values as dash placeholder", () => {
    expect(submissionDataText({ 备注: null })).toBe("备注: -");
  });
});
