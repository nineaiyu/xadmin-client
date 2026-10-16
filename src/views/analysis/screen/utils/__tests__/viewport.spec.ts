import { describe, expect, it } from "vitest";
import {
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEPS,
  ZOOM_VIEWPORT_PADDING,
  anchorScroll,
  clampZoom,
  fitZoom,
  stepZoom
} from "../viewport";

const DESIGN = { design_w: 1920, design_h: 1080 };

describe("显示缩放纯换算", () => {
  it("clampZoom：夹在 25%~200%，非有限值回落 100%", () => {
    expect(clampZoom(0.1)).toBe(ZOOM_MIN);
    expect(clampZoom(5)).toBe(ZOOM_MAX);
    expect(clampZoom(0.83)).toBeCloseTo(0.83, 5);
    expect(clampZoom(Number.NaN)).toBe(1);
  });

  it("fitZoom：取较小的比例并向下取整到 1%（避免取整后溢出容器）", () => {
    // 可用区 (1280-32)/1920 = 0.65、(720-32)/1080 = 0.637 → 0.63
    expect(fitZoom(1280, 720, DESIGN)).toBe(0.63);
    // 视口比画幅大：仍按「可用区 / 画幅」两侧取小后取整（宽约束不算唯一）
    expect(fitZoom(3840, 2160, DESIGN)).toBe(1.97);
    // 极大视口夹到上限
    expect(fitZoom(20000, 20000, DESIGN)).toBe(ZOOM_MAX);
    // 极小视口：夹到下限
    expect(fitZoom(100, 100, DESIGN)).toBe(ZOOM_MIN);
  });

  it("fitZoom：画幅非法时回落 100%", () => {
    expect(fitZoom(1280, 720, { design_w: 0, design_h: 1080 })).toBe(1);
  });

  it("stepZoom：档位上跳相邻档，两端夹住", () => {
    expect(stepZoom(1, 1)).toBe(1.25);
    expect(stepZoom(1, -1)).toBe(0.75);
    expect(stepZoom(ZOOM_STEPS[0], -1)).toBe(ZOOM_MIN);
    expect(stepZoom(ZOOM_MAX, 1)).toBe(ZOOM_MAX);
  });

  it("stepZoom：非档位值（适应窗口算出的比例）取方向侧最近档", () => {
    expect(stepZoom(0.63, 1)).toBe(0.75);
    expect(stepZoom(0.63, -1)).toBe(0.5);
    expect(stepZoom(1.9, 1)).toBe(2);
  });

  it("anchorScroll：缩放前后指针下的数据点保持不动", () => {
    const viewport = {
      scrollLeft: 300,
      scrollTop: 120,
      pointerX: 400,
      pointerY: 260
    };
    const from = 1;
    const to = 1.5;
    const dataX =
      (viewport.scrollLeft + viewport.pointerX - ZOOM_VIEWPORT_PADDING) / from;
    const dataY =
      (viewport.scrollTop + viewport.pointerY - ZOOM_VIEWPORT_PADDING) / from;

    const { scrollLeft, scrollTop } = anchorScroll(from, to, viewport);
    // 换算回数据坐标应一致（允许 1e-6 浮点误差）
    expect(
      (scrollLeft + viewport.pointerX - ZOOM_VIEWPORT_PADDING) / to
    ).toBeCloseTo(dataX, 6);
    expect(
      (scrollTop + viewport.pointerY - ZOOM_VIEWPORT_PADDING) / to
    ).toBeCloseTo(dataY, 6);
  });

  it("anchorScroll：缩小到画幅小于视口时滚动量为 0（不出现负滚动）", () => {
    const { scrollLeft, scrollTop } = anchorScroll(1, 0.25, {
      scrollLeft: 0,
      scrollTop: 0,
      pointerX: 200,
      pointerY: 200
    });
    expect(scrollLeft).toBe(0);
    expect(scrollTop).toBe(0);
  });
});
