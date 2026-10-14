import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  estimateLabelTextWidth,
  resolveAdaptiveLabelWidth
} from "../adaptiveLabelWidth";

/** 工具内部常量口径（冒号 + 右内边距 + 安全余量），测试侧显式复核 */
const DECORATION = 6 + 12 + 2;

describe("estimateLabelTextWidth", () => {
  it("全角按 1em、半角按 0.6em 估算", () => {
    expect(estimateLabelTextWidth("ab")).toBeCloseTo(16.8);
    expect(estimateLabelTextWidth("中文")).toBeCloseTo(28);
  });
});

describe("resolveAdaptiveLabelWidth", () => {
  beforeAll(() => {
    // jsdom 未实现 canvas 2d 上下文：固定走估算分支，保证断言确定
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });
  afterAll(() => vi.restoreAllMocks());

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
    expect(width).toBeLessThanOrEqual(240);
  });

  it("带帮助文本的标签额外预留图标宽度", () => {
    const label = "书籍名称与出版社";
    const plain = Number.parseInt(resolveAdaptiveLabelWidth([{ label }]), 10);
    const withTooltip = Number.parseInt(
      resolveAdaptiveLabelWidth([{ label, tooltip: "示例说明" }]),
      10
    );
    expect(plain).toBeGreaterThan(100);
    expect(withTooltip).toBe(plain + 20);
  });

  it("超长标签钳制在上限，取当前表单内最长者", () => {
    const longLabel = "这是一个非常非常非常非常非常非常长的标签文本";
    expect(resolveAdaptiveLabelWidth([{ label: longLabel }])).toBe("240px");
    expect(
      resolveAdaptiveLabelWidth([{ label: "名称" }, { label: longLabel }])
    ).toBe("240px");
  });
});
