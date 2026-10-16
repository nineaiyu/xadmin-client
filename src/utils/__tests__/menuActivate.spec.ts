import { describe, expect, it } from "vitest";

import type { menuType } from "@/layout/types";
import { firstLeafPath } from "../menuActivate";

const node = (path: string, children?: menuType[]): menuType =>
  ({ path, children, value: undefined }) as menuType;

describe("firstLeafPath", () => {
  it("多子项时取第一个子项的完整路径", () => {
    const item = node("/system", [node("/system/user"), node("/system/role")]);
    expect(firstLeafPath(item, "/system")).toBe("/system/user");
  });

  it("第一个子项带子级时继续下钻到叶子", () => {
    const item = node("/approval", [
      node("/approval/flow", [
        node("/approval/flow/list"),
        node("/approval/flow/version")
      ]),
      node("/approval/instance")
    ]);
    expect(firstLeafPath(item, "/approval")).toBe("/approval/flow/list");
  });

  it("相对路径按父级完整路径拼接", () => {
    const item = node("/demo", [node("book"), node("shelf")]);
    expect(firstLeafPath(item, "/demo")).toBe("/demo/book");
  });

  it("第一个子项为外链时跳过，取其后第一个可导航项", () => {
    const item = node("/ops", [
      node("https://example.com/console"),
      node("/ops/monitor")
    ]);
    expect(firstLeafPath(item, "/ops")).toBe("/ops/monitor");
  });

  it("全部子项为外链时返回 null", () => {
    const item = node("/ops", [node("https://example.com/a")]);
    expect(firstLeafPath(item, "/ops")).toBeNull();
  });

  it("无子项时返回 null（不是父级展开场景）", () => {
    expect(firstLeafPath(node("/system"), "/system")).toBeNull();
  });

  it("子树中间层全为外链时，回退取兄弟分支的叶子", () => {
    const item = node("/a", [
      node("/a/b", [node("https://example.com/x")]),
      node("/a/c")
    ]);
    expect(firstLeafPath(item, "/a")).toBe("/a/c");
  });
});
