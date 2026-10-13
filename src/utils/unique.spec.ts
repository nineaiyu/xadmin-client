import { describe, expect, it } from "vitest";

import { mergeUnique, unique } from "./unique";

describe("unique 数组去重", () => {
  it("保序去重：首见元素保留", () => {
    expect(unique(["b", "a", "b", "c", "a"])).toEqual(["b", "a", "c"]);
  });

  it("不修改入参", () => {
    const input = ["a", "a", "b"];
    unique(input);
    expect(input).toEqual(["a", "a", "b"]);
  });

  it("空数组与单元素", () => {
    expect(unique([])).toEqual([]);
    expect(unique(["x"])).toEqual(["x"]);
  });

  it("对象按引用去重（同引用判同值）", () => {
    const ref = { id: 1 };
    expect(unique([ref, { id: 1 }, ref])).toEqual([ref, { id: 1 }]);
  });
});

describe("mergeUnique 合并去重", () => {
  it("多数组合并保序去重（等价此前手写实现）", () => {
    expect(mergeUnique(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
    expect(mergeUnique(["a", "b"], ["b", "c"], ["c", "d", "a"])).toEqual([
      "a",
      "b",
      "c",
      "d"
    ]);
  });

  it("空数组参与时退化为拷贝", () => {
    expect(mergeUnique([], ["a"])).toEqual(["a"]);
    expect(mergeUnique(["a"], [])).toEqual(["a"]);
    expect(mergeUnique()).toEqual([]);
  });

  it("调用方原数组保持不变", () => {
    const picked = ["a"];
    const custom = ["a", "b"];
    mergeUnique(picked, custom);
    expect(picked).toEqual(["a"]);
    expect(custom).toEqual(["a", "b"]);
  });
});
