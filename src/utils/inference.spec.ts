import { describe, expect, it } from "vitest";

import { getFirstNonNullOrUndefined } from "./inference";

describe("getFirstNonNullOrUndefined", () => {
  it("返回第一个非 null / undefined 的值", () => {
    expect(
      getFirstNonNullOrUndefined<number | string>(undefined, null, 42, "hello")
    ).toBe(42);
    expect(
      getFirstNonNullOrUndefined<number | string>(null, undefined, "hello", 123)
    ).toBe("hello");
  });

  it("保留假值（0 / 空串 / false 视为有效）", () => {
    expect(getFirstNonNullOrUndefined(null, 0, 1)).toBe(0);
    expect(getFirstNonNullOrUndefined(undefined, "", "x")).toBe("");
    expect(getFirstNonNullOrUndefined(null, false, true)).toBe(false);
  });

  it("全为空时返回 undefined", () => {
    expect(getFirstNonNullOrUndefined(undefined, null)).toBeUndefined();
    expect(getFirstNonNullOrUndefined()).toBeUndefined();
  });
});
