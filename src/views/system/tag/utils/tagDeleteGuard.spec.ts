import { describe, expect, it } from "vitest";

import { canDeleteTag } from "./tagDeleteGuard";

describe("标签删除入口", () => {
  it("有删除权限且非内置、未被引用时显示", () => {
    expect(canDeleteTag({ builtin: false, usage_count: 0 }, true)).toBe(true);
    expect(canDeleteTag({ usage_count: 0 }, true)).toBe(true);
  });

  it("内置标签隐藏（点击必然失败）", () => {
    expect(canDeleteTag({ builtin: true, usage_count: 0 }, true)).toBe(false);
  });

  it("使用中的标签隐藏（需先解绑）", () => {
    expect(canDeleteTag({ builtin: false, usage_count: 3 }, true)).toBe(false);
  });

  it("无删除权限或空行不显示", () => {
    expect(canDeleteTag({ usage_count: 0 }, false)).toBe(false);
    expect(canDeleteTag(undefined, true)).toBe(false);
  });
});
