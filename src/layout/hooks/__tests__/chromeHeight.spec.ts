import { describe, expect, it } from "vitest";

import { resolveChromeHeight } from "../chromeHeight";

/**
 * 固定头部总高的输入组合表驱动测试（提纯前该算式内联在 layout/index.vue，
 * 组合态只靠人工枚举、无系统性验证）。
 * 组合维度：全屏内容 × 隐藏页签 × CSS 级隐藏顶栏 × 页签风格。
 */

const cases: Array<{
  name: string;
  input: Parameters<typeof resolveChromeHeight>[0];
  expected: string;
}> = [
  {
    name: "全屏内容：外壳整块不渲染，总高 0",
    input: {
      fullContent: true,
      hideTabs: false,
      headerHidden: false,
      tagsStyle: "chrome"
    },
    expected: "0px"
  },
  {
    name: "全屏内容优先级最高（其余开关不再参与）",
    input: {
      fullContent: true,
      hideTabs: true,
      headerHidden: true,
      tagsStyle: "card"
    },
    expected: "0px"
  },
  {
    name: "隐藏页签：只剩顶栏",
    input: {
      fullContent: false,
      hideTabs: true,
      headerHidden: false,
      tagsStyle: "chrome"
    },
    expected: "var(--layout-header-h)"
  },
  {
    name: "隐藏页签 + 隐藏顶栏：双空 0",
    input: {
      fullContent: false,
      hideTabs: true,
      headerHidden: true,
      tagsStyle: "chrome"
    },
    expected: "0px"
  },
  {
    name: "chrome 风格：页签 chrome 档高度",
    input: {
      fullContent: false,
      hideTabs: false,
      headerHidden: false,
      tagsStyle: "chrome"
    },
    expected: "var(--layout-tags-chrome-h)"
  },
  {
    name: "非 chrome 风格（card/plain）一律按 compact 档",
    input: {
      fullContent: false,
      hideTabs: false,
      headerHidden: false,
      tagsStyle: "card"
    },
    expected: "var(--layout-tags-compact-h)"
  },
  {
    name: "隐藏顶栏：页签条占位并扣减顶栏预留高度（chrome 档）",
    input: {
      fullContent: false,
      hideTabs: false,
      headerHidden: true,
      tagsStyle: "chrome"
    },
    expected: "calc(var(--layout-tags-chrome-h) - var(--layout-header-h))"
  },
  {
    name: "隐藏顶栏：扣减口径在 compact 档一致",
    input: {
      fullContent: false,
      hideTabs: false,
      headerHidden: true,
      tagsStyle: "plain"
    },
    expected: "calc(var(--layout-tags-compact-h) - var(--layout-header-h))"
  }
];

describe("resolveChromeHeight", () => {
  for (const { name, input, expected } of cases) {
    it(name, () => {
      expect(resolveChromeHeight(input)).toBe(expected);
    });
  }
});
