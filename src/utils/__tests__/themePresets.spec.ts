import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CUSTOM_THEME_PRESET,
  DEFAULT_THEME_PRESET,
  isBuiltinThemePreset,
  themePresetPrimary,
  themePresetPrimaryHex,
  themePresets
} from "@/layout/hooks/themePresets";

/**
 * 主题预设漂移守卫：预设清单（TS，面板与主色接管的数据源）必须与
 * `src/style/tokens/presets.scss` 的表面色系块严格对应——新增预设时两处都要落，
 * 否则面板能选中但表面不生效（或反之留下死代码块）。
 */

const ROOT = resolve(__dirname, "../../..");
const SCSS = readFileSync(join(ROOT, "src/style/tokens/presets.scss"), "utf-8");

/** 表面着色预设（默认预设不写属性、自定义预设不做着色，均无 SCSS 块） */
const coloredTypes = themePresets
  .map(item => item.type)
  .filter(type => type !== DEFAULT_THEME_PRESET);

describe("主题预设：清单与令牌块同源", () => {
  it("presets.scss 的预设集合与 TS 清单一致", () => {
    // 仅取真实选择器（注释里的占位写法形如 `"<预设>"`，不含字母数字）
    const scssTypes = [
      ...SCSS.matchAll(/html(?:\.dark)?\[data-theme-preset="([A-Za-z-]+)"\]/g)
    ].map(match => match[1]);
    expect(new Set(scssTypes)).toEqual(new Set(coloredTypes));
  });

  it("每个着色预设同时提供亮色与暗色块", () => {
    for (const type of coloredTypes) {
      expect(SCSS).toContain(`html[data-theme-preset="${type}"]`);
      expect(SCSS).toContain(`html.dark[data-theme-preset="${type}"]`);
    }
  });

  it("色卡色值为合法 hex，且默认预设色值与主色令牌一致", () => {
    for (const item of themePresets) {
      expect(item.swatch).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(themePresetPrimaryHex(DEFAULT_THEME_PRESET, false)).toBe("#006be6");
  });
});

describe("主题预设：主色接管口径", () => {
  it("自定义与未知值不接管主色", () => {
    expect(isBuiltinThemePreset(CUSTOM_THEME_PRESET)).toBe(false);
    expect(isBuiltinThemePreset("not-a-preset")).toBe(false);
    expect(themePresetPrimary(CUSTOM_THEME_PRESET, false)).toBe("");
    expect(themePresetPrimaryHex("not-a-preset", true)).toBe("");
  });

  it("内置预设按明暗取配套主色（中性预设暗色用亮色主色）", () => {
    expect(themePresetPrimary("zinc", false)).not.toBe(
      themePresetPrimary("zinc", true)
    );
    for (const type of coloredTypes) {
      expect(themePresetPrimaryHex(type, false)).toMatch(/^#[0-9a-f]{6}$/);
      expect(themePresetPrimaryHex(type, true)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
