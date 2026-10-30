import { describe, expect, it } from "vitest";

import {
  clamp,
  displayAngle,
  moveToAngle,
  moveToPuzzleX,
  pieceGeometry,
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

  it("拼块视觉位移与提交答案同源（视觉对齐即命中目标 x）", () => {
    // 弹窗 440px / 设置页预览 310px / 宽容器 640px 三种真实形态：
    // 修复前视觉用 displayX*scale、答案用另一套自然 px 映射，容器宽度与滑条
    // 宽度不等时按视觉对齐的答案会偏 6%~12%，超过后端 4px 容差。
    const cases = [
      { naturalWidth: 320, pieceSize: 56, stageWidth: 440, sliderWidth: 440 },
      { naturalWidth: 320, pieceSize: 56, stageWidth: 310, sliderWidth: 310 },
      { naturalWidth: 640, pieceSize: 56, stageWidth: 300, sliderWidth: 300 }
    ];
    for (const item of cases) {
      const maxMoveX = sliderMax(item.sliderWidth);
      const movable = item.naturalWidth - item.pieceSize;
      for (const ratio of [0, 0.25, 0.5, 0.75, 1]) {
        const targetX = ratio * movable;
        // 用户把拼块拖到缺口上方 => 滑条位移按同一比例给出
        const moveX = ratio * maxMoveX;
        const layout = pieceGeometry(
          moveX,
          maxMoveX,
          item.naturalWidth,
          item.pieceSize,
          item.stageWidth
        );
        // 视觉位置换算回自然坐标必须等于提交答案
        expect(layout.leftPx / layout.scale).toBeCloseTo(layout.answerX, 6);
        // 视觉对齐的答案落在后端 4px 容差内
        expect(Math.abs(layout.answerX - targetX)).toBeLessThanOrEqual(4);
      }
    }
  });

  it("滑杆拖到末端时拼块停在可移动宽度上限", () => {
    const layout = pieceGeometry(254, 254, 320, 56, 440);
    expect(layout.answerX).toBe(264);
    expect(layout.leftPx).toBeCloseTo(264 * (440 / 320), 6);
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
