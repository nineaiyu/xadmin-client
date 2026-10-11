import { describe, expect, it } from "vitest";
import {
  FREE_GRID_DEFAULT_STEP,
  FREE_SNAP_THRESHOLD,
  snapFreeBox,
  type FreeSnapGuide
} from "../freeSnap";

/**
 * 自由画布吸附参考线单测：命中阈值内的对齐（窗格边框与中性线 + 画幅边界与中线），
 * 返回吸附后的盒模型与命中的参考线集合。
 */

const DESIGN = { design_w: 1920, design_h: 1080 };
const OTHER = { x: 400, y: 300, w: 300, h: 300 };

const hasGuide = (guides: FreeSnapGuide[], axis: "x" | "y", position: number) =>
  guides.some(guide => guide.axis === axis && guide.position === position);

describe("snapFreeBox 拖动吸附", () => {
  it("左边缘与另一窗格左边缘在阈值内对齐（返回吸附后坐标与参考线）", () => {
    // 左边缘 402 距目标 400 差 2px：吸附回 400，参考线命中 400
    const result = snapFreeBox(
      { x: 402, y: 100, w: 200, h: 100 },
      [OTHER],
      DESIGN
    );
    expect(result.box).toEqual({ x: 400, y: 100, w: 200, h: 100 });
    expect(hasGuide(result.guides, "x", 400)).toBe(true);
  });

  it("超出阈值不吸附（保留自由摆放手感，参考线为空）", () => {
    const result = snapFreeBox(
      { x: 406, y: 100, w: 200, h: 100 },
      [OTHER],
      DESIGN
    );
    expect(result.box).toEqual({ x: 406, y: 100, w: 200, h: 100 });
    expect(result.guides).toEqual([]);
  });

  it("阈值边界：恰好 4px 命中、5px 不命中", () => {
    const hit = snapFreeBox(
      { x: 404, y: 100, w: 200, h: 100 },
      [OTHER],
      DESIGN
    );
    expect(hit.box.x).toBe(400);
    const miss = snapFreeBox(
      { x: 405, y: 100, w: 200, h: 100 },
      [OTHER],
      DESIGN
    );
    expect(miss.box.x).toBe(405);
    expect(FREE_SNAP_THRESHOLD).toBe(4);
  });

  it("窗格中心线与画幅中线吸附（横向居中对齐）", () => {
    // 中心 962 距画幅中线 960 差 2px → 回正，参考线命中画幅中线
    const result = snapFreeBox(
      { x: 862, y: 100, w: 200, h: 100 },
      [OTHER],
      DESIGN
    );
    expect(result.box.x).toBe(860);
    expect(hasGuide(result.guides, "x", DESIGN.design_w / 2)).toBe(true);
  });

  it("纵向吸附：上边缘对齐另一窗格上边缘", () => {
    const result = snapFreeBox(
      { x: 10, y: 302, w: 200, h: 100 },
      [OTHER],
      DESIGN
    );
    expect(result.box.y).toBe(300);
    expect(hasGuide(result.guides, "y", 300)).toBe(true);
  });
});

describe("snapFreeBox 缩放吸附", () => {
  it("右边缘吸附到另一窗格左边缘（对边保持不动）", () => {
    // 右边缘 397 距目标 400 差 3px：宽度扩到 300，左边缘仍 100
    const result = snapFreeBox(
      { x: 100, y: 100, w: 297, h: 100 },
      [OTHER],
      DESIGN,
      "br"
    );
    expect(result.box).toEqual({ x: 100, y: 100, w: 300, h: 100 });
    expect(hasGuide(result.guides, "x", 400)).toBe(true);
  });

  it("左边缘吸附到另一窗格左边缘（右边缘保持不动）", () => {
    // 左边缘 403 距目标 400 差 3px：x 回 400，宽度变为 303
    const result = snapFreeBox(
      { x: 403, y: 100, w: 300, h: 100 },
      [OTHER],
      DESIGN,
      "tl"
    );
    expect(result.box).toEqual({ x: 400, y: 100, w: 303, h: 100 });
    expect(hasGuide(result.guides, "x", 400)).toBe(true);
  });

  it("下边缘吸附到画幅底边（缩放不越界）", () => {
    const result = snapFreeBox(
      { x: 100, y: 900, w: 300, h: 178 },
      [OTHER],
      DESIGN,
      "bm"
    );
    expect(result.box.h).toBe(180);
    expect(hasGuide(result.guides, "y", DESIGN.design_h)).toBe(true);
  });

  it("缩放吸附后小于最小尺寸时放弃该轴吸附", () => {
    // 目标线落在左边缘右侧 2px，吸附会把宽度压到 14px（<16）：放弃吸附
    const result = snapFreeBox(
      { x: 418, y: 100, w: 16, h: 100 },
      [{ x: 420, y: 0, w: 100, h: 100 }],
      DESIGN,
      "ml"
    );
    expect(result.box).toEqual({ x: 418, y: 100, w: 16, h: 100 });
  });

  it("拖动方向不吸附（横拖不改纵向尺寸）", () => {
    const result = snapFreeBox(
      { x: 100, y: 302, w: 200, h: 100 },
      [OTHER],
      DESIGN,
      "mr"
    );
    expect(result.box.y).toBe(302);
    expect(result.box.h).toBe(100);
  });
});

describe("snapFreeBox 网格吸附（ADR-088）", () => {
  const GRID = { enabled: true, step: FREE_GRID_DEFAULT_STEP };

  it("参考线未命中时落到步长倍数（拖动）", () => {
    const result = snapFreeBox(
      { x: 406, y: 103, w: 200, h: 100 },
      [OTHER],
      DESIGN,
      "",
      FREE_SNAP_THRESHOLD,
      GRID
    );
    expect(result.box).toEqual({ x: 408, y: 104, w: 200, h: 100 });
    expect(result.guides).toEqual([]);
  });

  it("参考线优先：阈值内命中参考线，不被网格拽走", () => {
    // 另一窗格左边缘 403：本窗格 400 距其 3px（阈值内）→ 对到 403；
    // 若走网格会停在 400（8 的倍数）——此处断言 403 即证明优先级
    const result = snapFreeBox(
      { x: 400, y: 100, w: 200, h: 100 },
      [{ ...OTHER, x: 403 }],
      DESIGN,
      "",
      FREE_SNAP_THRESHOLD,
      GRID
    );
    expect(result.box.x).toBe(403);
    expect(hasGuide(result.guides, "x", 403)).toBe(true);
  });

  it("网格关闭时行为与一期一致（越界不吸附）", () => {
    const result = snapFreeBox(
      { x: 406, y: 103, w: 200, h: 100 },
      [OTHER],
      DESIGN,
      "",
      FREE_SNAP_THRESHOLD,
      { enabled: false, step: 8 }
    );
    expect(result.box).toEqual({ x: 406, y: 103, w: 200, h: 100 });
  });

  it("缩放只对被拖动的边落网格，对边与坐标不动", () => {
    const result = snapFreeBox(
      { x: 100, y: 100, w: 203, h: 153 },
      [OTHER],
      DESIGN,
      "br",
      FREE_SNAP_THRESHOLD,
      { enabled: true, step: 10 }
    );
    expect(result.box).toEqual({ x: 100, y: 100, w: 200, h: 150 });
  });

  it("网格吸附不得把窗格压到最小尺寸以下（该轴放弃落网格）", () => {
    const result = snapFreeBox(
      { x: 100, y: 100, w: 49, h: 100 },
      [OTHER],
      DESIGN,
      "br",
      FREE_SNAP_THRESHOLD,
      { enabled: true, step: 100 }
    );
    expect(result.box.w).toBe(49);
  });
});
