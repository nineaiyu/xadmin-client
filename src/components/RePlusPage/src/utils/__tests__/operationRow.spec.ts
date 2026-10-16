import { describe, expect, it } from "vitest";
import { resolveOperationRow } from "../operationRow";

describe("resolveOperationRow", () => {
  const rowA = { pk: "a", name: "A" };
  const rowB = { pk: "b", name: "B" };
  const dataList = [rowA, rowB];

  it("有内容的 row 原样返回（第三方 cloneDeep 副本足够展示用）", () => {
    expect(resolveOperationRow(rowA, 0, dataList)).toBe(rowA);
  });

  it("空对象 row 按行号取真实行（cloneDeep 退化为空对象的场景）", () => {
    expect(resolveOperationRow({}, 1, dataList)).toBe(rowB);
  });

  it("row 与行号双缺失时返回空对象（与旧行为一致，不抛错）", () => {
    expect(resolveOperationRow(undefined, undefined, dataList)).toEqual({});
    expect(resolveOperationRow({}, 99, dataList)).toEqual({});
    expect(resolveOperationRow({}, "x", undefined)).toEqual({});
  });
});
