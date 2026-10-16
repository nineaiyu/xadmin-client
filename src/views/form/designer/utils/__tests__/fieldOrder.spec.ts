import { describe, expect, it } from "vitest";
import { moveItem } from "../fieldOrder";

describe("moveItem", () => {
  it("向后位移", () => {
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("向前位移", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("越界或同位返回原引用（不产生无意义更新）", () => {
    const items = ["a", "b"];
    expect(moveItem(items, 0, 0)).toBe(items);
    expect(moveItem(items, -1, 1)).toBe(items);
    expect(moveItem(items, 0, 2)).toBe(items);
    expect(moveItem(items, 5, 0)).toBe(items);
  });

  it("空数组安全", () => {
    expect(moveItem([], 0, 1)).toEqual([]);
  });
});
