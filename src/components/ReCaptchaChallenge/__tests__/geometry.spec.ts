import { describe, expect, it } from "vitest";

import {
  clamp,
  displayAngle,
  moveToAngle,
  moveToPuzzleX,
  sliderMax,
  toNaturalPoint
} from "../src/geometry";

describe("交互式验证码几何映射", () => {
  it("sliderMax 复用滑条轨道口径且非负", () => {
    expect(sliderMax(300)).toBe(254);
    expect(sliderMax(20)).toBe(0);
  });

  it("拼块横向映射覆盖可移动宽度", () => {
    expect(moveToPuzzleX(0, 254, 320, 56)).toBe(0);
    expect(moveToPuzzleX(254, 254, 320, 56)).toBe(264);
    expect(moveToPuzzleX(127, 254, 320, 56)).toBe(132);
    expect(moveToPuzzleX(500, 254, 320, 56)).toBe(264);
    expect(moveToPuzzleX(10, 0, 320, 56)).toBe(0);
  });

  it("滑杆映射旋转角 -180~180", () => {
    expect(moveToAngle(0, 200)).toBe(-180);
    expect(moveToAngle(100, 200)).toBe(0);
    expect(moveToAngle(200, 200)).toBe(180);
    expect(moveToAngle(10, 0)).toBe(0);
  });

  it("点击坐标按显示尺寸换算到自然像素并夹紧边界", () => {
    const rect = { left: 10, top: 20, width: 640, height: 360 };
    expect(toNaturalPoint(10, 20, rect, 320, 180)).toEqual({ x: 0, y: 0 });
    expect(toNaturalPoint(650, 380, rect, 320, 180)).toEqual({
      x: 320,
      y: 180
    });
    expect(toNaturalPoint(330, 200, rect, 320, 180)).toEqual({
      x: 160,
      y: 90
    });
  });

  it("displayAngle 归一到 -180~180 且 180 保持正向", () => {
    expect(displayAngle(0)).toBe(0);
    expect(displayAngle(190)).toBe(-170);
    expect(displayAngle(-190)).toBe(170);
    expect(clamp(5, 0, 3)).toBe(3);
  });
});
