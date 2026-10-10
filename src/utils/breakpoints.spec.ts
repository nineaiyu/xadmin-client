import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { BREAKPOINTS, isAbove, isBelow, mediaQueryBelow } from "./breakpoints";

describe("设计体系断点", () => {
  it("与 SCSS 令牌同源：两侧数值逐项一致", () => {
    const scss = readFileSync(
      resolve(process.cwd(), "src/style/tokens/breakpoints.scss"),
      "utf-8"
    );
    const entries = Object.entries(BREAKPOINTS);
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, value] of entries) {
      expect(
        new RegExp(`\\b${key}:\\s*${value}px`).test(scss),
        `SCSS 侧 ${key} 应为 ${value}px`
      ).toBe(true);
    }
  });

  it("isBelow / isAbove 按视口宽度判定且互为补集", () => {
    vi.stubGlobal("innerWidth", BREAKPOINTS.md);
    expect(isBelow("md")).toBe(true);
    expect(isAbove("md")).toBe(false);

    vi.stubGlobal("innerWidth", BREAKPOINTS.md + 1);
    expect(isBelow("md")).toBe(false);
    expect(isAbove("md")).toBe(true);
    vi.unstubAllGlobals();
  });

  it("mediaQueryBelow 产出 matchMedia 可消费的查询串", () => {
    expect(mediaQueryBelow("lg")).toBe("(width <= 1024px)");
  });

  it("尺度有序递增（防手改乱序）", () => {
    const values = Object.values(BREAKPOINTS);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
  });
});
