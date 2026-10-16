import { describe, expect, it } from "vitest";

import { filterByKeyword } from "./keywordFilter";

type Row = { name?: string | null; code?: string | null; size?: number };

const rows: Row[] = [
  { name: "研发部", code: "RD", size: 10 },
  { name: "销售部", code: "SALE", size: 20 },
  { name: "Product", code: "PD", size: 30 },
  { name: null, code: null, size: 40 }
];

const fields = (row: Row) => [row.name, row.code];

describe("filterByKeyword（客户端关键词过滤）", () => {
  it("空关键词返回全量（短路，原引用）", () => {
    expect(filterByKeyword(rows, "", fields)).toBe(rows);
    expect(filterByKeyword(rows, "   ", fields)).toBe(rows);
  });

  it("单字段命中", () => {
    expect(filterByKeyword(rows, "研发", fields).map(r => r.size)).toEqual([
      10
    ]);
  });

  it("多字段任一命中（name 或 code）", () => {
    expect(filterByKeyword(rows, "SALE", fields).map(r => r.size)).toEqual([
      20
    ]);
    expect(filterByKeyword(rows, "pd", fields).map(r => r.size)).toEqual([30]);
  });

  it("大小写不敏感", () => {
    expect(filterByKeyword(rows, "product", fields).map(r => r.size)).toEqual([
      30
    ]);
    expect(filterByKeyword(rows, "rd", fields).map(r => r.size)).toEqual([10]);
  });

  it("关键词两侧空白被裁剪", () => {
    expect(filterByKeyword(rows, "  研发  ", fields).map(r => r.size)).toEqual([
      10
    ]);
  });

  it("字段缺失（null / undefined）按空串处理不抛错", () => {
    expect(filterByKeyword(rows, "研发", row => [row.name])).toHaveLength(1);
    expect(filterByKeyword(rows, "x", () => [undefined, null])).toEqual([]);
  });

  it("非字符串字段 String 化后参与匹配", () => {
    expect(
      filterByKeyword(rows, "30", row => [row.size]).map(r => r.size)
    ).toEqual([30]);
  });

  it("无命中返回空数组（不修改源）", () => {
    const result = filterByKeyword(rows, "不存在的词", fields);
    expect(result).toEqual([]);
    expect(rows).toHaveLength(4);
  });
});
