import { describe, expect, it } from "vitest";

import {
  clampToParent,
  dragBox,
  resizeBox,
  type BoxConstraints
} from "../src/geometry";

const base: BoxConstraints = {
  minw: 20,
  minh: 20,
  aspectRatio: false,
  parentLimitation: false,
  parentW: 500,
  parentH: 400
};

describe("ReResize geometry 纯函数", () => {
  it("clampToParent：尺寸不超父容器、位置不越界", () => {
    expect(clampToParent({ x: -20, y: -10, w: 100, h: 100 }, 500, 400)).toEqual(
      {
        x: 0,
        y: 0,
        w: 100,
        h: 100
      }
    );
    expect(clampToParent({ x: 480, y: 380, w: 100, h: 100 }, 500, 400)).toEqual(
      {
        x: 400,
        y: 300,
        w: 100,
        h: 100
      }
    );
    expect(clampToParent({ x: 0, y: 0, w: 600, h: 500 }, 500, 400)).toEqual({
      x: 0,
      y: 0,
      w: 500,
      h: 400
    });
  });

  it("dragBox：位移叠加；父容器约束时钳制在边界内", () => {
    expect(dragBox({ x: 10, y: 10, w: 100, h: 100 }, 30, 5, base)).toEqual({
      x: 40,
      y: 15,
      w: 100,
      h: 100
    });
    const limited = dragBox({ x: 10, y: 10, w: 100, h: 100 }, -100, 500, {
      ...base,
      parentLimitation: true
    });
    expect(limited).toEqual({ x: 0, y: 300, w: 100, h: 100 });
  });

  it("resizeBox：右下角手柄按位移增减宽高", () => {
    expect(
      resizeBox({ x: 10, y: 10, w: 100, h: 100 }, "br", 50, 30, base)
    ).toEqual({ x: 10, y: 10, w: 150, h: 130 });
  });

  it("resizeBox：左上角手柄同时移动位置与宽高", () => {
    expect(
      resizeBox({ x: 100, y: 100, w: 100, h: 100 }, "tl", 20, 20, base)
    ).toEqual({ x: 120, y: 120, w: 80, h: 80 });
  });

  it("resizeBox：小于最小尺寸时收敛到 minw/minh 并回退位置", () => {
    expect(
      resizeBox({ x: 100, y: 100, w: 100, h: 100 }, "tl", 500, 500, base)
    ).toEqual({ x: 180, y: 180, w: 20, h: 20 });
  });

  it("resizeBox：等比缩放保持起手宽高比", () => {
    const out = resizeBox({ x: 0, y: 0, w: 200, h: 100 }, "br", 100, 0, {
      ...base,
      aspectRatio: true
    });
    expect(out.w).toBe(300);
    expect(out.h).toBe(150);
  });

  it("resizeBox：父容器约束时右 / 下边不越界", () => {
    const out = resizeBox({ x: 400, y: 300, w: 100, h: 100 }, "br", 999, 999, {
      ...base,
      parentLimitation: true
    });
    expect(out.x + out.w).toBeLessThanOrEqual(500);
    expect(out.y + out.h).toBeLessThanOrEqual(400);
  });
});
