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

  it("renders attachment names and detail-row counts instead of JSON", () => {
    expect(
      submissionDataText({
        附件: [{ filename: "a.pdf" }, { filename: "b.pdf" }]
      })
    ).toBe("附件: a.pdf、b.pdf");
    expect(submissionDataText({ 明细: [{ a: 1 }, { a: 2 }] })).toBe(
      "明细: 2 行"
    );
    expect(
      submissionDataText(
        { 明细: [{ a: 1 }, { a: 2 }, { a: 3 }] },
        { tableRows: count => `${count} rows` }
      )
    ).toBe("明细: 3 rows");
  });

  it("joins date ranges with enumeration separator", () => {
    expect(submissionDataText({ 日期: ["2026-01-01", "2026-01-31"] })).toBe(
      "日期: 2026-01-01、2026-01-31"
    );
  });

  it("truncates long summaries and keeps full text on demand", () => {
    const data = { 字段: "x".repeat(200) };
    expect(submissionDataText(data)).toHaveLength(161);
    expect(submissionDataText(data).endsWith("…")).toBe(true);
    expect(submissionDataText(data, { maxLength: 0 })).toHaveLength(204);
  });

  it("renders null values as dash placeholder", () => {
    expect(submissionDataText({ 备注: null })).toBe("备注: -");
  });
});
