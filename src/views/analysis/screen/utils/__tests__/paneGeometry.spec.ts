import { describe, expect, it } from "vitest";
import {
  isAxisAligned,
  rectIntersectsPane,
  rectsIntersect,
  rotatedBounds,
  rotatedCorners
} from "../paneGeometry";

const BOX = { x: 100, y: 100, w: 200, h: 100 };

describe("isAxisAligned", () => {
  it("0 / ±360 视为轴对齐，其余角度不算", () => {
    expect(isAxisAligned()).toBe(true);
    expect(isAxisAligned(0)).toBe(true);
    expect(isAxisAligned(360)).toBe(true);
    expect(isAxisAligned(-360)).toBe(true);
    for (const angle of [45, 90, 180, 270, -90]) {
      expect(isAxisAligned(angle)).toBe(false);
    }
  });
});

describe("rotatedBounds", () => {
  it("轴对齐角度恒等返回（不引入浮点漂移）", () => {
    expect(rotatedBounds(BOX, 0)).toEqual(BOX);
    expect(rotatedBounds(BOX, 360)).toEqual(BOX);
  });

  it("90°：宽高互换（外接盒 = 互换后的盒）", () => {
    expect(rotatedBounds(BOX, 90)).toMatchObject({ w: 100, h: 200 });
  });

  it("45°：外接盒为 (w+h)/√2 的方形，且中心不变", () => {
    const square = { x: 0, y: 0, w: 100, h: 100 };
    const bounds = rotatedBounds(square, 45);
    const side = (100 + 100) / Math.SQRT2;
    expect(bounds.w).toBeCloseTo(side, 6);
    expect(bounds.h).toBeCloseTo(side, 6);
    expect(bounds.x + bounds.w / 2).toBeCloseTo(50, 6);
    expect(bounds.y + bounds.h / 2).toBeCloseTo(50, 6);
  });

  it("四角绕几何中心旋转（90° 后长边变竖直）", () => {
    const corners = rotatedCorners(BOX, 90);
    const xs = corners.map(point => point.x);
    const ys = corners.map(point => point.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(100, 6);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(200, 6);
  });
});

describe("rectsIntersect / rectIntersectsPane", () => {
  it("轴对齐：重叠相交、相切算相交、分离不算", () => {
    expect(
      rectsIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })
    ).toBe(true);
    expect(
      rectsIntersect(
        { x: 0, y: 0, w: 10, h: 10 },
        { x: 10, y: 0, w: 10, h: 10 }
      )
    ).toBe(true);
    expect(
      rectsIntersect(
        { x: 0, y: 0, w: 10, h: 10 },
        { x: 11, y: 0, w: 10, h: 10 }
      )
    ).toBe(false);
  });

  it("旋转 45° 的细条：只压到 AABB 空角的选择框**不算**命中（SAT 而非 AABB）", () => {
    // 200×20 的细条水平放，绕中心转 45°：本体从左下走向右上（屏幕坐标 y 向下）
    const bar = { x: 0, y: 90, w: 200, h: 20 };
    const bounds = rotatedBounds(bar, 45);
    // 右上角是空角（本体对角走向，不覆盖那里）；若按 AABB 判定会被误判命中
    const corner = { x: bounds.x + bounds.w - 8, y: bounds.y, w: 8, h: 8 };
    expect(rectIntersectsPane(corner, bar, 45)).toBe(false);
    // 中心处的小块则必然命中
    const center = { x: 95, y: 95, w: 10, h: 10 };
    expect(rectIntersectsPane(center, bar, 45)).toBe(true);
  });

  it("旋转 90°：命中范围按互换后的实际覆盖区", () => {
    const pane = { x: 100, y: 100, w: 200, h: 100 };
    // 旋转 90° 后实际覆盖 x∈[150,250]、y∈[50,250]
    expect(rectIntersectsPane({ x: 180, y: 60, w: 10, h: 10 }, pane, 90)).toBe(
      true
    );
    // 原未旋转盒的右端（x≈290）在旋转后已不覆盖
    expect(rectIntersectsPane({ x: 290, y: 140, w: 10, h: 10 }, pane, 90)).toBe(
      false
    );
  });

  it("轴对齐角度走原路径（与历史逐值一致）", () => {
    const rect = { x: 0, y: 0, w: 10, h: 10 };
    const pane = { x: 5, y: 5, w: 10, h: 10 };
    expect(rectIntersectsPane(rect, pane, 0)).toBe(true);
    expect(rectIntersectsPane(rect, pane, 360)).toBe(true);
  });
});
