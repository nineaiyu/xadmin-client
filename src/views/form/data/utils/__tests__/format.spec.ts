import { describe, expect, it } from "vitest";
import type { FormField } from "@/api/dataset/dform";
import { fieldValueText, inlineOptionLabel } from "../format";

const makeField = (overrides: Partial<FormField>): FormField => ({
  key: "k",
  label: "字段",
  type: "input",
  ...overrides
});

describe("inlineOptionLabel", () => {
  it("字符串选项按值匹配", () => {
    const field = makeField({ type: "select", options: ["甲", "乙"] });
    expect(inlineOptionLabel(field, "乙")).toBe("乙");
    expect(inlineOptionLabel(field, "丙")).toBeUndefined();
  });

  it("对象选项按 value 匹配输出 label", () => {
    const field = makeField({
      type: "radio",
      options: [{ value: "1", label: "选项一" }]
    });
    expect(inlineOptionLabel(field, 1)).toBe("选项一");
  });
});

describe("fieldValueText", () => {
  it("空值返回占位符（可自定义）", () => {
    const field = makeField({});
    expect(fieldValueText(field, null)).toBe("-");
    expect(fieldValueText(field, "")).toBe("-");
    expect(fieldValueText(field, undefined, { emptyText: "—" })).toBe("—");
  });

  it("switch 走布尔文案解析器（缺省 true/false）", () => {
    const field = makeField({ type: "switch" });
    expect(fieldValueText(field, true)).toBe("true");
    expect(
      fieldValueText(field, false, {
        booleanText: value => (value ? "是" : "否")
      })
    ).toBe("否");
  });

  it("checkbox / daterange 数组以顿号连接", () => {
    expect(fieldValueText(makeField({ type: "checkbox" }), ["甲", "乙"])).toBe(
      "甲、乙"
    );
    expect(
      fieldValueText(makeField({ type: "daterange" }), [
        "2026-01-01",
        "2026-01-02"
      ])
    ).toBe("2026-01-01、2026-01-02");
  });

  it("cascader 以斜杠连接路径", () => {
    expect(
      fieldValueText(makeField({ type: "cascader" }), ["华东", "上海"])
    ).toBe("华东 / 上海");
  });

  it("明细子表输出行数文案", () => {
    const field = makeField({ type: "table" });
    expect(
      fieldValueText(field, [{ a: 1 }, { a: 2 }], {
        tableRows: count => `${count} 行`
      })
    ).toBe("2 行");
    expect(fieldValueText(field, [])).toBe("-");
  });

  it("附件输出文件名清单", () => {
    const field = makeField({ type: "upload" });
    expect(
      fieldValueText(field, [
        { filename: "合同.pdf" },
        { filename: "附件.png" }
      ])
    ).toBe("合同.pdf、附件.png");
    expect(fieldValueText(field, [{ filename: "" }])).toBe("-");
  });

  it("选人优先走回显解析器，未命中回落 pk", () => {
    const field = makeField({ type: "user" });
    expect(
      fieldValueText(field, [1, 2], {
        user: pk => (pk === "1" ? "张三" : undefined)
      })
    ).toBe("张三、2");
  });

  it("select 优先字典解析器，其次内联选项，最后原始值", () => {
    const field = makeField({
      type: "select",
      options: [{ value: "b", label: "内联B" }]
    });
    expect(fieldValueText(field, "a", { option: () => "字典A" })).toBe("字典A");
    expect(fieldValueText(field, "b")).toBe("内联B");
    expect(fieldValueText(field, "c")).toBe("c");
  });

  it("对象值 JSON 化（无专用控件时）", () => {
    expect(fieldValueText(makeField({}), { a: 1 })).toBe('{"a":1}');
  });
});
