import { describe, expect, it } from "vitest";
import {
  estimateLabelTextWidth,
  resolveAdaptiveLabelWidth
} from "../adaptiveLabelWidth";

// jsdom 不做布局：离屏 span 的 getBoundingClientRect 恒为 0，工具自动回退到
// 估算路径（全角 1em / 半角 0.6em），因此断言确定可复现。
/** 工具内部口径（冒号 6 + 标签右内边距 12 + 安全余量 4） */
const DECORATION = 6 + 12 + 4;
/** 帮助文本图标占位（估算路径固定预留） */
const TOOLTIP = 24;
/** 宽度上限 */
const MAX_WIDTH = 300;

describe("estimateLabelTextWidth", () => {
  it("全角按 1em、半角按 0.6em 估算", () => {
    expect(estimateLabelTextWidth("ab")).toBeCloseTo(16.8);
    expect(estimateLabelTextWidth("中文")).toBeCloseTo(28);
  });
});

describe("resolveAdaptiveLabelWidth", () => {
  it("空列与短标签回落到最小宽度", () => {
    expect(resolveAdaptiveLabelWidth([])).toBe("100px");
    expect(resolveAdaptiveLabelWidth([{ label: "名称" }])).toBe("100px");
    expect(resolveAdaptiveLabelWidth([{ label: null }, { label: "" }])).toBe(
      "100px"
    );
  });

  it("长标签按内容加宽，不再折行", () => {
    const label = "是否启用（自定义删除时间）";
    const width = Number.parseInt(resolveAdaptiveLabelWidth([{ label }]), 10);
    expect(width).toBe(Math.ceil(estimateLabelTextWidth(label) + DECORATION));
    expect(width).toBeGreaterThan(100);
    expect(width).toBeLessThanOrEqual(MAX_WIDTH);
  });

  it("带帮助文本的标签额外预留图标宽度", () => {
    const label = "书籍名称与出版社";
    const plain = Number.parseInt(resolveAdaptiveLabelWidth([{ label }]), 10);
    const withTooltip = Number.parseInt(
      resolveAdaptiveLabelWidth([{ label, tooltip: "示例说明" }]),
      10
    );
    expect(plain).toBeGreaterThan(100);
    expect(withTooltip).toBe(plain + TOOLTIP);
  });

  it("超长标签钳制在上限，取当前表单内最长者", () => {
    const longLabel = "这是一个非常非常非常非常非常非常长的标签文本";
    expect(resolveAdaptiveLabelWidth([{ label: longLabel }])).toBe(
      `${MAX_WIDTH}px`
    );
    expect(
      resolveAdaptiveLabelWidth([{ label: "名称" }, { label: longLabel }])
    ).toBe(`${MAX_WIDTH}px`);
  });

  it("窄视口下按视口比例收敛，避免控件列被压死", () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      value: 500,
      configurable: true,
      writable: true
    });
    const longLabel = "这是一个非常非常非常非常非常非常长的标签文本";
    expect(resolveAdaptiveLabelWidth([{ label: longLabel }])).toBe("200px");
    Object.defineProperty(window, "innerWidth", {
      value: originalWidth,
      configurable: true,
      writable: true
    });
  });
});
