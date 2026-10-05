import { describe, expect, it } from "vitest";

import { getMenuFromPk, getMenuOrderPk } from "./menu";

describe("getMenuOrderPk", () => {
  it("嵌套 children 前序收集 pk", () => {
    const data = [
      { pk: 1, children: [{ pk: 2 }, { pk: 3, children: [{ pk: 4 }] }] },
      { pk: 5 }
    ];
    expect(getMenuOrderPk(data)).toEqual([1, 2, 3, 4, 5]);
  });

  it("含空 children 数组的节点", () => {
    const data = [{ pk: 1, children: [] }, { pk: 2 }];
    expect(getMenuOrderPk(data)).toEqual([1, 2]);
  });

  it("非数组入参返回传入的 x", () => {
    expect(getMenuOrderPk(undefined)).toEqual([]);
    expect(getMenuOrderPk(null)).toEqual([]);
    expect(getMenuOrderPk({})).toEqual([]);
    const x = [99];
    expect(getMenuOrderPk(undefined, x)).toBe(x);
  });
});

describe("getMenuFromPk", () => {
  const tree = [
    {
      pk: 1,
      parent: 0,
      children: [{ pk: 11, parent: 1, children: [{ pk: 111, parent: 11 }] }]
    },
    { pk: 2, parent: 0 }
  ];

  it("叶子 pk 返回叶子到根的祖先链", () => {
    const ancestors = getMenuFromPk(tree, 111);
    expect(ancestors.map(m => m.pk)).toEqual([111, 11, 1]);
  });

  it("未找到的 pk 返回空数组", () => {
    expect(getMenuFromPk(tree, 999)).toEqual([]);
  });
});
