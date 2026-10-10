import { describe, expect, it } from "vitest";

import {
  DEFAULT_ADAPTIVE_OFFSET_BOTTOM,
  MIN_ADAPTIVE_TABLE_HEIGHT,
  correctHeightByOverflow
} from "../src/utils/tableMeasureMath";

/**
 * 表格自适应高度自校正：内容区滚动容器只要溢出 1px 就会常驻滚动条，
 * 因此高度必须按实测溢出量回收，而不是只依赖固定底部预留。
 */
describe("correctHeightByOverflow", () => {
  it("无溢出（含 1px 容差）时保持原高度", () => {
    expect(correctHeightByOverflow(420, 0)).toBe(420);
    expect(correctHeightByOverflow(420, -12)).toBe(420);
    expect(correctHeightByOverflow(420, 1)).toBe(420);
  });

  it("按溢出差值等量回收", () => {
    expect(correctHeightByOverflow(420, 2)).toBe(418);
    expect(correctHeightByOverflow(420, 36)).toBe(384);
  });

  it("回收后不低于最小可用高度", () => {
    expect(correctHeightByOverflow(300, 200)).toBe(MIN_ADAPTIVE_TABLE_HEIGHT);
    expect(correctHeightByOverflow(MIN_ADAPTIVE_TABLE_HEIGHT, 500)).toBe(
      MIN_ADAPTIVE_TABLE_HEIGHT
    );
  });

  it("最小高度可覆写（页面级口径）", () => {
    expect(correctHeightByOverflow(300, 100, 250)).toBe(250);
  });

  it("异常溢出值（NaN/Infinity）不改变高度", () => {
    expect(correctHeightByOverflow(420, Number.NaN)).toBe(420);
    expect(correctHeightByOverflow(420, Number.POSITIVE_INFINITY)).toBe(420);
  });
});

describe("DEFAULT_ADAPTIVE_OFFSET_BOTTOM", () => {
  it("保持列表页直铺口径的预留值", () => {
    expect(DEFAULT_ADAPTIVE_OFFSET_BOTTOM).toBe(110);
  });
});
