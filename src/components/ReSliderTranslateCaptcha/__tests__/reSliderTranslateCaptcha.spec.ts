import { describe, expect, it } from "vitest";

import {
  isTranslatePassing,
  pieceLeftFromMove,
  pieceMaxOffset,
  randomOffset
} from "../src/geometry";

describe("拼图验证码几何", () => {
  it("pieceMaxOffset 为图片边长减去拼图块边长且非负", () => {
    expect(pieceMaxOffset(260, 48)).toBe(212);
    expect(pieceMaxOffset(40, 48)).toBe(0);
  });

  it("pieceLeftFromMove 把滑条行程等比映射到拼图区间", () => {
    // 滑条行程用尽 → 拼图块到最右
    expect(pieceLeftFromMove(200, 200, 260, 48)).toBe(212);
    // 行程过半 → 拼图位移过半
    expect(pieceLeftFromMove(100, 200, 260, 48)).toBe(106);
    // 越界被夹回区间
    expect(pieceLeftFromMove(999, 200, 260, 48)).toBe(212);
    expect(pieceLeftFromMove(-5, 200, 260, 48)).toBe(0);
  });

  it("pieceLeftFromMove 行程或区间为 0 时返回 0", () => {
    expect(pieceLeftFromMove(100, 0, 260, 48)).toBe(0);
    expect(pieceLeftFromMove(100, 200, 40, 48)).toBe(0);
  });

  it("randomOffset 落在 [0, 区间] 内", () => {
    expect(randomOffset(260, 48, () => 0)).toBe(0);
    expect(randomOffset(260, 48, () => 0.999)).toBeLessThanOrEqual(212);
  });

  it("isTranslatePassing 按容差判定", () => {
    expect(isTranslatePassing(100, 106, 8)).toBe(true);
    expect(isTranslatePassing(100, 120, 8)).toBe(false);
  });
});
