import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { hexToHslTriplet, hexToRgb, hslTripletToHex } from "./color";
import {
  DEFAULT_EP_THEME_COLOR,
  DEFAULT_PRIMARY_TRIPLET
} from "./themeConstants";

describe("颜色换算 hex ⇄ HSL 三元组", () => {
  it("默认主色：常量与设计令牌同源（三方解析一致）", () => {
    // 令牌三元组 → hex，必须等于默认主色常量（单向严格一致）
    expect(hslTripletToHex(DEFAULT_PRIMARY_TRIPLET)).toBe(
      DEFAULT_EP_THEME_COLOR
    );
    // 常量 hex → 三元组 → hex 往返无损（反算允许 ±0.1 的等价三元组解）
    expect(hslTripletToHex(hexToHslTriplet(DEFAULT_EP_THEME_COLOR))).toBe(
      DEFAULT_EP_THEME_COLOR
    );
  });

  it("primitives.scss 的 --primary 与默认主色常量一致（防令牌漂移）", () => {
    const scss = readFileSync(
      resolve(process.cwd(), "src/style/tokens/primitives.scss"),
      "utf-8"
    );
    expect(scss).toContain(`--primary: ${DEFAULT_PRIMARY_TRIPLET};`);
  });

  it("hex → 三元组：解析回 RGB 与原值逐通道一致", () => {
    const cases = [
      "#006be6",
      "#409eff",
      "#722ed1",
      "#eb2f96",
      "#13c2c2",
      "#52c41a",
      "#ffffff",
      "#000000",
      "#f2f3f5"
    ];
    for (const hex of cases) {
      const triplet = hexToHslTriplet(hex);
      expect(triplet, `${hex} 应可换算`).not.toBe("");
      expect(hslTripletToHex(triplet), `${hex} 换算应无损`).toBe(hex);
    }
  });

  it("支持三位短写与裸写；非法输入返回空串 / null", () => {
    expect(hslTripletToHex(hexToHslTriplet("#fff"))).toBe("#ffffff");
    expect(hslTripletToHex(hexToHslTriplet("006be6"))).toBe("#006be6");
    expect(hexToHslTriplet("not-a-color")).toBe("");
    expect(hexToRgb("#12")).toBeNull();
    expect(hslTripletToHex("212 100%")).toBe("");
  });
});
