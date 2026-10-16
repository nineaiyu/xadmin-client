import { describe, expect, it } from "vitest";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import {
  clampGroupDelta,
  panesInRect,
  rectFromPoints,
  rectHitsPane,
  selectionBounds
} from "../freeSelect";

const DESIGN = { design_w: 1920, design_h: 1080 };

const pane = (
  pk: string,
  box: { x: number; y: number; w: number; h: number }
): ScreenLayoutPane => ({ pk, type: "text", ...box });

const A = pane("a", { x: 100, y: 100, w: 200, h: 100 });
const B = pane("b", { x: 400, y: 200, w: 300, h: 150 });
const C = pane("c", { x: 1000, y: 900, w: 100, h: 100 });
const PANES = [A, B, C];

describe("框选几何", () => {
  it("rectFromPoints：任意方向拖动都归一为正矩形", () => {
    expect(rectFromPoints(300, 400, 100, 150)).toEqual({
      x: 100,
      y: 150,
      w: 200,
      h: 250
    });
  });

  it("rectHitsPane：任意重叠即命中，边界相接不算", () => {
    expect(rectHitsPane({ x: 150, y: 150, w: 10, h: 10 }, A)).toBe(true);
    // 矩形贴在 A 的右边界（相接不算命中）
    expect(rectHitsPane({ x: 300, y: 100, w: 50, h: 50 }, A)).toBe(false);
    // 完全包含
    expect(rectHitsPane({ x: 0, y: 0, w: 500, h: 500 }, A)).toBe(true);
  });

  it("panesInRect：按数组顺序返回命中的 pk（层级顺序）", () => {
    expect(panesInRect(PANES, { x: 0, y: 0, w: 800, h: 800 })).toEqual([
      "a",
      "b"
    ]);
    expect(panesInRect(PANES, { x: 1100, y: 100, w: 50, h: 50 })).toEqual([]);
  });

  it("selectionBounds：包围盒取并集，空选区返回 null", () => {
    expect(selectionBounds(PANES, ["a", "b"])).toEqual({
      x: 100,
      y: 100,
      w: 600,
      h: 250
    });
    expect(selectionBounds(PANES, [])).toBeNull();
  });
});

describe("组位移夹取", () => {
  it("整组不越界：向左上贴边、向右下贴边各夹一次", () => {
    // 选区包围盒 x=100..700、y=100..350
    expect(clampGroupDelta(PANES, ["a", "b"], -500, -500, DESIGN)).toEqual({
      dx: -100,
      dy: -100
    });
    expect(clampGroupDelta(PANES, ["a", "b"], 5000, 5000, DESIGN)).toEqual({
      dx: DESIGN.design_w - 700,
      dy: DESIGN.design_h - 350
    });
  });

  it("阈值内的位移原样返回；空选区不改动", () => {
    expect(clampGroupDelta(PANES, ["a", "b"], 40, -30, DESIGN)).toEqual({
      dx: 40,
      dy: -30
    });
    expect(clampGroupDelta(PANES, [], 40, -30, DESIGN)).toEqual({
      dx: 40,
      dy: -30
    });
  });
});

describe("旋转窗格的框选与包围盒（ADR-090 D2）", () => {
  const textPane = (
    pk: string,
    box: { x: number; y: number; w: number; h: number },
    rotate?: number
  ) =>
    ({
      pk,
      type: "text",
      ...box,
      ...(rotate ? { rotate } : {})
    }) as ScreenLayoutPane;

  it("框选按旋转矩形命中：AABB 角落不算命中", () => {
    const pane = textPane("a", { x: 0, y: 90, w: 200, h: 20 }, 45);
    // 细条 45° 后的外接盒右上角小块（本体对角走向，不覆盖那里）
    const corner = { x: 160, y: 60, w: 6, h: 6 };
    expect(panesInRect([pane], corner)).toEqual([]);
    // 中心必然命中
    expect(panesInRect([pane], { x: 90, y: 90, w: 10, h: 10 })).toEqual(["a"]);
  });

  it("选区包围盒取视觉 AABB（旋转后比原始盒大）", () => {
    const pane = textPane("a", { x: 0, y: 0, w: 100, h: 100 }, 45);
    const bounds = selectionBounds([pane], ["a"])!;
    expect(bounds.w).toBeCloseTo(100 * Math.SQRT2, 4);
    expect(bounds.x).toBeLessThan(0);
  });

  it("组夹取按视觉 AABB：旋转溢出画幅时整组停住", () => {
    const pane = textPane("a", { x: 0, y: 0, w: 100, h: 100 }, 45);
    const design = { design_w: 1000, design_h: 1000 };
    // 视觉盒左边界已经溢到 -20.71：向左推被夹到「把它推回画幅内」的 +20.71
    const clamped = clampGroupDelta([pane], ["a"], -50, 0, design);
    expect(clamped.dx).toBeCloseTo((100 * Math.SQRT2) / 2 - 100 / 2, 4);
  });
});
