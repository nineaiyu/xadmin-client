import { describe, expect, it } from "vitest";

import { MenuChoices } from "@/views/system/constants";
import { allowDropByType } from "../treeInteractions";

type Node = {
  data: { pk: string; menuType?: number };
  parent?: Node;
};

const node = (pk: string, parent?: Node, menuType?: number): Node => ({
  data: { pk, menuType },
  parent
});

describe("allowDropByType", () => {
  it("非 inner 拖拽不限制", () => {
    expect(allowDropByType(node("a"), node("b"), "before")).toBe(true);
    expect(allowDropByType(node("a"), node("b"), "after")).toBe(true);
  });

  it("权限点不能再挂子级", () => {
    const permission = node("p", undefined, MenuChoices.PERMISSION);
    expect(allowDropByType(node("a"), permission, "inner")).toBe(false);
  });

  it("禁止把父节点拖进自己的后代（防 parent 成环）", () => {
    const root = node("root");
    const child = node("child", root);
    const grandchild = node("grandchild", child);
    expect(allowDropByType(root, child, "inner")).toBe(false);
    expect(allowDropByType(root, grandchild, "inner")).toBe(false);
  });

  it("允许拖到无关节点或自己的上级", () => {
    const root = node("root");
    const child = node("child", root);
    const sibling = node("sibling", root);
    expect(allowDropByType(child, sibling, "inner")).toBe(true);
    expect(allowDropByType(child, root, "inner")).toBe(true);
  });
});
