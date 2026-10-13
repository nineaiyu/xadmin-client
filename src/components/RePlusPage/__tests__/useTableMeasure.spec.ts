import { describe, expect, it } from "vitest";

import {
  DEFAULT_ADAPTIVE_OFFSET_BOTTOM,
  MIN_ADAPTIVE_TABLE_HEIGHT,
  resolveAdaptiveHeight
} from "../src/utils/tableMeasureMath";

/**
 * 自适应高度的稳态解：`maxFit = 当前高度 - 带符号溢出`，
 * `next = clamp(min(期望高度, maxFit), 最小可用高度)`。
 */
describe("resolveAdaptiveHeight（稳态解）", () => {
  it("溢出为正：收缩到刚好填满容器", () => {
    expect(resolveAdaptiveHeight(297, 297, 23)).toBe(274);
  });

  it("溢出为负（仍有空闲）：增长到期望高度", () => {
    expect(resolveAdaptiveHeight(274, 297, -23)).toBe(297);
  });

  it("有空闲但期望高度更小：取期望高度（不越过可用空间估计）", () => {
    expect(resolveAdaptiveHeight(274, 260, -100)).toBe(260);
  });

  it("无溢出且当前高于期望：收缩到期望高度", () => {
    expect(resolveAdaptiveHeight(400, 350, 0)).toBe(350);
  });

  it("无溢出且当前低于期望（容器恰好填满）：保持当前高度", () => {
    expect(resolveAdaptiveHeight(350, 400, 0)).toBe(350);
  });

  it("剩余溢出无法消除时钳到最小可用高度", () => {
    expect(resolveAdaptiveHeight(260, 200, 124)).toBe(
      MIN_ADAPTIVE_TABLE_HEIGHT
    );
  });

  it("异常溢出值（NaN）按期望高度处理", () => {
    expect(resolveAdaptiveHeight(300, 320, Number.NaN)).toBe(320);
  });
});

/**
 * 收敛不变式（防「抖两次」与每帧互推）：把解写回后按线性关系重算溢出，
 * 再次求解必须得到同一取值——否则高度会在两个状态间来回跳。
 */
describe("resolveAdaptiveHeight 收敛性", () => {
  const cases = [
    { name: "溢出收缩", height: 297, desired: 297, overflow: 23 },
    { name: "空闲恢复", height: 274, desired: 297, overflow: -23 },
    { name: "无溢出收缩到期望", height: 400, desired: 350, overflow: 0 },
    { name: "容器恰好填满", height: 350, desired: 400, overflow: 0 },
    { name: "最小高度钳制", height: 260, desired: 200, overflow: 124 }
  ];

  for (const item of cases) {
    it(`${item.name}：写回后取值不变`, () => {
      const next = resolveAdaptiveHeight(
        item.height,
        item.desired,
        item.overflow
      );
      // 高度变化量按 1:1 反映到滚动容器溢出上
      const overflowAfter = item.overflow + (next - item.height);
      expect(resolveAdaptiveHeight(next, item.desired, overflowAfter)).toBe(
        next
      );
    });
  }
});

describe("DEFAULT_ADAPTIVE_OFFSET_BOTTOM", () => {
  it("保持列表页直铺口径的预留值", () => {
    expect(DEFAULT_ADAPTIVE_OFFSET_BOTTOM).toBe(110);
  });
});
