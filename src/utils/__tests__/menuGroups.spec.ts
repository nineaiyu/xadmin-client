import { describe, expect, it } from "vitest";
import type { menuType } from "@/layout/types";
import { groupMenuChildren, isMenuGroupNode } from "../menuGroups";

function node(path: string, extra: Partial<menuType["meta"]> = {}): menuType {
  return {
    value: undefined,
    path,
    name: path,
    meta: { title: path, ...extra }
  };
}

describe("groupMenuChildren", () => {
  it("无分组配置时原样返回（同一引用）", () => {
    const children = [node("/a"), node("/b")];
    expect(groupMenuChildren(children)).toBe(children);
  });

  it("空数组与 undefined 安全返回", () => {
    expect(groupMenuChildren([])).toEqual([]);
    expect(groupMenuChildren(undefined as never)).toEqual([]);
  });

  it("同组节点聚合到首次出现位置，组内保持原顺序", () => {
    const a = node("/a", { groupName: "基础" });
    const b = node("/b");
    const c = node("/c", { groupName: "基础" });
    const result = groupMenuChildren([a, b, c]);

    expect(result).toHaveLength(2);
    expect(isMenuGroupNode(result[0])).toBe(true);
    expect(result[0].children).toEqual([a, c]);
    expect(result[1]).toBe(b);
  });

  it("分组节点携带组标题并可被识别", () => {
    const result = groupMenuChildren([node("/a", { groupName: "高级" })]);
    expect(result[0].meta?.title).toBe("高级");
    expect(result[0].meta?.group).toBe(true);
    expect(result[0].path).toContain("高级");
  });

  it("多组按 groupRank 升序（相同位置序列内重排）", () => {
    const a = node("/a", { groupName: "组一", groupRank: 5 });
    const b = node("/b", { groupName: "组二", groupRank: 1 });
    const result = groupMenuChildren([a, b]);

    expect(result.map(item => item.meta?.title)).toEqual(["组二", "组一"]);
  });

  it("groupRank 缺省时按组内首成员 rank 排序", () => {
    const a = node("/a", { groupName: "组一", rank: 9 });
    const b = node("/b", { groupName: "组二", rank: 2 });
    const result = groupMenuChildren([a, b]);

    expect(result.map(item => item.meta?.title)).toEqual(["组二", "组一"]);
  });

  it("groupRank 缺省且无 rank 时按 0 参与（保持稳定顺序）", () => {
    const a = node("/a", { groupName: "组一" });
    const b = node("/b", { groupName: "组二" });
    const result = groupMenuChildren([a, b]);

    expect(result.map(item => item.meta?.title)).toEqual(["组一", "组二"]);
  });

  it("空白分组名视为未分组", () => {
    const a = node("/a", { groupName: "   " });
    const result = groupMenuChildren([a]);
    expect(result[0]).toBe(a);
    expect(isMenuGroupNode(result[0])).toBe(false);
  });

  it("未分组节点保持相对顺序且不与组内成员混排", () => {
    const a = node("/a");
    const b = node("/b", { groupName: "组" });
    const c = node("/c", { groupName: "组" });
    const d = node("/d");
    const result = groupMenuChildren([a, b, c, d]);

    expect(result.map(item => item.path)).toEqual([
      "/a",
      expect.stringContaining("组"),
      "/d"
    ]);
    expect(result[1].children).toEqual([b, c]);
  });
});
