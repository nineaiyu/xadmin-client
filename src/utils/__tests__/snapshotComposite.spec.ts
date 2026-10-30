import { describe, expect, it } from "vitest";

import { WATERMARK_GRID, layoutFlowTiles } from "@/utils/snapshotComposite";

/**
 * 快照合成的可测纯逻辑（flow 布局与水印网格参数）；canvas 绘制链路依赖
 * 浏览器 2d 上下文，由 E2E 快照按钮用例覆盖（jsdom 无 canvas）。
 */

describe("snapshotComposite flow 布局计算", () => {
  it("空卡列表：零高度、零盒位", () => {
    const { boxes, totalHeight } = layoutFlowTiles([], 1080);
    expect(boxes).toEqual([]);
    expect(totalHeight).toBe(0);
  });

  it("有图卡按宽高比等比换算高度（标题区 + 图区）", () => {
    const { boxes, totalHeight } = layoutFlowTiles(
      [{ title: "销量趋势", aspect: 2 }],
      1080
    );
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toMatchObject({ x: 0, y: 0, width: 1080 });
    // 图区高 = 1080 / 2 = 540；盒高 = 标题 34 + 540
    expect(boxes[0].height).toBe(34 + 540);
    expect(totalHeight).toBe(34 + 540);
  });

  it("无图卡（指标卡占位）给固定占位高度", () => {
    const { boxes } = layoutFlowTiles([{ title: "总数", aspect: null }], 800);
    expect(boxes[0].height).toBe(34 + 200);
  });

  it("高图（宽高比极小）按等比放大（占位高度只是下限，不裁剪）", () => {
    const { boxes } = layoutFlowTiles([{ title: "高图", aspect: 0.1 }], 1080);
    expect(boxes[0].height).toBe(34 + Math.round(1080 / 0.1));
  });

  it("多卡纵向堆叠：盒位含固定间距，尾卡不留尾距", () => {
    const { boxes, totalHeight } = layoutFlowTiles(
      [
        { title: "A", aspect: 2 },
        { title: "B", aspect: null }
      ],
      1080
    );
    const firstHeight = 34 + 540;
    expect(boxes[1].y).toBe(firstHeight + 16);
    expect(totalHeight).toBe(firstHeight + 16 + 34 + 200);
  });

  it("水印网格参数为低干扰口径（导出图可读性守护）", () => {
    expect(WATERMARK_GRID.alpha).toBeLessThanOrEqual(0.06);
    expect(WATERMARK_GRID.gapX).toBeGreaterThan(150);
    expect(WATERMARK_GRID.gapY).toBeGreaterThan(100);
  });
});
