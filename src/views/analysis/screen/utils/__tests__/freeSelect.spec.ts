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
