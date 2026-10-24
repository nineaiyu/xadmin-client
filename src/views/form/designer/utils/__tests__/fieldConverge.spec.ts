import { describe, expect, it } from "vitest";
import type { FormField } from "@/api/dataset/dform";
import { convergeFieldAttributes } from "../fieldConverge";

const field = (overrides: Partial<FormField>): FormField => ({
  key: "f1",
  label: "字段",
  type: "input",
  ...overrides
});

describe("convergeFieldAttributes", () => {
  it("select 改 input：清除 options/dict（后端 otherwise 拒绝保存）", () => {
    const row = field({
      type: "select",
      options: ["a", "b"],
      dict: "",
      max_length: 10
    });
    row.type = "input";
    convergeFieldAttributes(row);
    expect(row.options).toBeUndefined();
    expect(row.dict).toBeUndefined();
  });

  it("绑定了字典的选项控件改 input：字典一并清除", () => {
    const row = field({ type: "radio", dict: "book_type", options: [] });
    row.type = "input";
    convergeFieldAttributes(row);
    expect(row.dict).toBeUndefined();
    expect(row.options).toBeUndefined();
  });

  it("input 改 select：清除文本长度，保留 options 编辑入口语义", () => {
    const row = field({ type: "input", max_length: 100 });
    row.type = "select";
    convergeFieldAttributes(row);
    expect(row.max_length).toBeUndefined();
    expect("options" in row).toBe(false);
  });

  it("数值边界只在数值/金额控件保留", () => {
    const row = field({ type: "number", min: 1, max: 9, multiple: true });
    row.type = "amount";
    convergeFieldAttributes(row);
    expect(row.min).toBe(1);
    expect(row.max).toBe(9);
    expect(row.multiple).toBeUndefined();
    row.type = "input";
    convergeFieldAttributes(row);
    expect(row.min).toBeUndefined();
    expect(row.max).toBeUndefined();
  });

  it("precision 只在 amount/formula 保留", () => {
    const row = field({ type: "amount", precision: 3 });
    row.type = "number";
    convergeFieldAttributes(row);
    expect(row.precision).toBeUndefined();
  });

  it("formula：清除必填、精度缺省 2、保留表达式；非 formula 清除表达式", () => {
    const row = field({ type: "input", required: true, max_length: 50 });
    row.type = "formula";
    row.formula = "{n1} * 2";
    convergeFieldAttributes(row);
    expect(row.required).toBeUndefined();
    expect(row.precision).toBe(2);
    expect(row.formula).toBe("{n1} * 2");
    expect(row.max_length).toBeUndefined();
    row.type = "input";
    convergeFieldAttributes(row);
    expect(row.formula).toBeUndefined();
  });

  it("table：columns 仅表格控件保留，options 从选项控件切来时清除", () => {
    const row = field({ type: "select", options: ["a"] });
    row.type = "table";
    row.columns = [{ key: "c1", label: "列1", type: "input" }];
    convergeFieldAttributes(row);
    expect(row.options).toBeUndefined();
    expect(row.columns).toHaveLength(1);
    row.type = "input";
    convergeFieldAttributes(row);
    expect(row.columns).toBeUndefined();
  });

  it("选项形态互斥：平铺（字符串）与级联（树形）互切时清空待重填", () => {
    const row = field({ type: "select", options: ["a", "b"] });
    row.type = "cascader";
    convergeFieldAttributes(row);
    expect(row.options).toBeUndefined();

    row.type = "select";
    row.options = [{ value: 1, label: "节点" }];
    convergeFieldAttributes(row);
    expect(row.options).toBeUndefined();
  });

  it("filterable 只在可筛选控件保留", () => {
    const row = field({ type: "select", filterable: true, options: ["a"] });
    row.type = "upload";
    convergeFieldAttributes(row);
    expect(row.filterable).toBeUndefined();

    row.type = "input";
    row.filterable = true;
    convergeFieldAttributes(row);
    expect(row.filterable).toBe(true);
  });

  it("绑定字典的选项控件：内联选项被清空（互斥口径与后端一致）", () => {
    const row = field({ type: "select", dict: "book_type", options: ["a"] });
    convergeFieldAttributes(row);
    expect(row.dict).toBe("book_type");
    expect(row.options).toEqual([]);
  });

  it("返回同一对象（行内编辑就地改 row 的语义）", () => {
    const row = field({});
    expect(convergeFieldAttributes(row)).toBe(row);
  });
});
