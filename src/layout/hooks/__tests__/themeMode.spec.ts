import { describe, expect, it } from "vitest";

import { normalizeThemeMode } from "../themeMode";

describe("normalizeThemeMode", () => {
  it("保留合法枚举", () => {
    expect(normalizeThemeMode("")).toBe("");
    expect(normalizeThemeMode("system")).toBe("system");
    expect(normalizeThemeMode("light")).toBe("light");
    expect(normalizeThemeMode("dark")).toBe("dark");
  });

  it("布尔/未知值回落为空字符串（登录页 el-switch 曾写入 true/false）", () => {
    expect(normalizeThemeMode(true)).toBe("");
    expect(normalizeThemeMode(false)).toBe("");
    expect(normalizeThemeMode("auto")).toBe("");
    expect(normalizeThemeMode(undefined)).toBe("");
    expect(normalizeThemeMode(null)).toBe("");
  });
});
