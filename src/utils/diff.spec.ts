import { describe, expect, it } from "vitest";

import { arraysEqual, arraysStrictEqual, diff, diffStrict } from "./diff";

describe("diff 差异计算", () => {
  it("两值相等时返回 undefined", () => {
    expect(diff({ a: 1 }, { a: 1 })).toBeUndefined();
  });

  it("标量变化只保留新值", () => {
    expect(diff({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual({ b: 3 });
  });

  it("嵌套对象只保留发生变化的键", () => {
    const oldVal = { user: { name: "a", age: 1 }, keep: true };
    const newVal = { user: { name: "a", age: 2 }, keep: true };
    expect(diff(oldVal, newVal)).toEqual({ user: { age: 2 } });
  });

  it("数组默认忽略顺序", () => {
    expect(diff({ list: [1, 2] }, { list: [2, 1] })).toBeUndefined();
    expect(diff({ list: [1, 2] }, { list: [1, 3] })).toEqual({ list: [1, 3] });
  });

  it("diffStrict 数组顺序敏感", () => {
    expect(diffStrict({ list: [1, 2] }, { list: [2, 1] })).toEqual({
      list: [2, 1]
    });
  });

  it("新增的键计入差异", () => {
    expect(diff({ a: 1 }, { a: 1, b: 2 })).toEqual({ b: 2 });
  });

  it("数组比较工具", () => {
    expect(arraysEqual([1, 2, 2], [2, 1, 2])).toBe(true);
    expect(arraysEqual([1, 2], [1, 2, 2])).toBe(false);
    expect(arraysStrictEqual([1, 2], [1, 2])).toBe(true);
    expect(arraysStrictEqual([1, 2], [2, 1])).toBe(false);
  });
});
