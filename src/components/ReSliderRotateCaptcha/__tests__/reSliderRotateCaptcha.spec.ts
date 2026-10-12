import { describe, expect, it } from "vitest";

import { isRotatePassing, randomRotate, rotateFromMove } from "../src/geometry";

describe("旋转验证码几何", () => {
  it("rotateFromMove 按位移比例换算角度", () => {
    // 位移 = 图片宽度的一半 → 0.5 × 1.5 × 300 = 225
    expect(rotateFromMove(130, 260, 300)).toBe(225);
    expect(rotateFromMove(0, 260, 300)).toBe(0);
  });

  it("rotateFromMove 图片宽度非法时返回 0", () => {
    expect(rotateFromMove(100, 0, 300)).toBe(0);
  });

  it("randomRotate 落在 [min, max) 内且受注入随机数控制", () => {
    expect(randomRotate(120, 300, () => 0)).toBe(120);
    expect(randomRotate(120, 300, () => 0.999)).toBeLessThan(300);
    const value = randomRotate(120, 300, () => 0.5);
    expect(value).toBeGreaterThanOrEqual(120);
    expect(value).toBeLessThan(300);
  });

  it("randomRotate 对颠倒的上下限同样安全", () => {
    expect(randomRotate(300, 120, () => 0)).toBe(120);
  });

  it("isRotatePassing 按容差判定", () => {
    expect(isRotatePassing(200, 185, 20)).toBe(true);
    expect(isRotatePassing(200, 170, 20)).toBe(false);
    expect(isRotatePassing(200, 200, 0)).toBe(false);
  });
});
