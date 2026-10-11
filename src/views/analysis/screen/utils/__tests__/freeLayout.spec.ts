import { describe, expect, it } from "vitest";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import {
  FREE_DESIGN_DEFAULTS,
  FREE_DESIGN_MAX_W,
  FREE_DESIGN_MIN_W,
  FREE_MIN_PANE_SIZE,
  FREE_PANE_DEFAULTS,
  buildFreeLayout,
  cascadedBox,
  clampDesign,
  clampFreeBox,
  freeBoxFromOffset,
  normalizeFreePanes,
  readFreeLayout
} from "../freeLayout";

const DESIGN = { design_w: 1920, design_h: 1080 };

const pane = (
  pk: string,
  box: { x: number; y: number; w: number; h: number },
  type: ScreenLayoutPane["type"] = "clock"
): ScreenLayoutPane => ({ pk, type, ...box });

describe("自由画布几何口径", () => {
  it("clampDesign：缺省 1920×1080，非法值回落缺省，越界夹回范围", () => {
    expect(clampDesign()).toEqual(FREE_DESIGN_DEFAULTS);
    expect(clampDesign({})).toEqual(FREE_DESIGN_DEFAULTS);
    // 非有限数值回落缺省；有限但越界夹回允许范围（0 → 下限）
    expect(clampDesign({ design_w: Number.NaN, design_h: 0 })).toEqual({
      design_w: FREE_DESIGN_DEFAULTS.design_w,
      design_h: 240
    });
    expect(clampDesign({ design_w: 100, design_h: 999999 })).toEqual({
      design_w: FREE_DESIGN_MIN_W,
      design_h: 4320
    });
    expect(clampDesign({ design_w: 999999 })).toEqual({
      design_w: FREE_DESIGN_MAX_W,
      design_h: FREE_DESIGN_DEFAULTS.design_h
    });
  });

  it("clampFreeBox：尺寸下限 16，越界夹回画幅，负数归零", () => {
    expect(clampFreeBox({ x: -40, y: -40, w: 4, h: 8 }, DESIGN)).toEqual({
      x: 0,
      y: 0,
      w: FREE_MIN_PANE_SIZE,
      h: FREE_MIN_PANE_SIZE
    });
    expect(clampFreeBox({ x: 1900, y: 1000, w: 400, h: 300 }, DESIGN)).toEqual({
      x: 1520,
      y: 780,
      w: 400,
      h: 300
    });
    // 尺寸超过整幅时收敛到画幅
    expect(clampFreeBox({ x: 0, y: 0, w: 9999, h: 9999 }, DESIGN)).toEqual({
      x: 0,
      y: 0,
      w: DESIGN.design_w,
      h: DESIGN.design_h
    });
  });

  it("freeBoxFromOffset：落点越界夹回（拖放到画布外也不发注定被拒的请求）", () => {
    expect(freeBoxFromOffset(300, 200, { w: 240, h: 120 }, DESIGN)).toEqual({
      x: 300,
      y: 200,
      w: 240,
      h: 120
    });
    expect(freeBoxFromOffset(-10, -10, { w: 240, h: 120 }, DESIGN)).toEqual({
      x: 0,
      y: 0,
      w: 240,
      h: 120
    });
  });

  it("cascadedBox：连续新增逐个错开且夹回画幅", () => {
    const first = cascadedBox(0, { w: 240, h: 120 }, DESIGN);
    const second = cascadedBox(1, { w: 240, h: 120 }, DESIGN);
    expect(first).toEqual({ x: 80, y: 80, w: 240, h: 120 });
    expect(second).toEqual({ x: 104, y: 104, w: 240, h: 120 });
  });

  it("normalizeFreePanes：只保留声明键，按类型补默认值，坐标夹回画幅", () => {
    const panes: ScreenLayoutPane[] = [
      {
        ...pane("d1", { x: 10, y: 10, w: 480, h: 320 }, "dashboard"),
        dashboard: "dash-1"
      },
      { ...pane("t1", { x: 20, y: 20, w: 600, h: 80 }, "text"), text: "标语" },
      {
        ...pane("i1", { x: 30, y: 30, w: 320, h: 240 }, "image"),
        url: "https://a.b/c.png"
      },
      { ...pane("c1", { x: 1910, y: 1000, w: 240, h: 120 }) }
    ];
    const normalised = normalizeFreePanes(panes, DESIGN);
    expect(normalised[0]).toEqual({
      pk: "d1",
      type: "dashboard",
      dashboard: "dash-1",
      x: 10,
      y: 10,
      w: 480,
      h: 320
    });
    expect(normalised[1]).toMatchObject({
      pk: "t1",
      type: "text",
      text: "标语",
      align: "left",
      size: 24
    });
    expect(normalised[2]).toMatchObject({ fit: "cover" });
    // 越界窗格就地夹回（不阻断保存）
    expect(normalised[3]).toEqual({
      pk: "c1",
      type: "clock",
      x: DESIGN.design_w - 240,
      y: DESIGN.design_h - 120,
      w: 240,
      h: 120,
      size: 40
    });
  });

  it("normalizeFreePanes 指标卡：count 丢 value_field，sum 保留", () => {
    const metric: ScreenLayoutPane = {
      ...pane("m1", { x: 0, y: 0, w: 240, h: 120 }, "metric"),
      dataset: "ds-1",
      metric: "count",
      value_field: "amount"
    };
    expect(normalizeFreePanes([metric], DESIGN)[0]).not.toHaveProperty(
      "value_field"
    );
    metric.metric = "sum";
    expect(normalizeFreePanes([metric], DESIGN)[0].value_field).toBe("amount");
  });

  it("buildFreeLayout：组装画幅 + 归一化窗格", () => {
    const layout = buildFreeLayout(
      [pane("c1", { x: 0, y: 0, w: 240, h: 120 })],
      {
        design_w: 2560,
        design_h: 1440
      }
    );
    expect(layout.design_w).toBe(2560);
    expect(layout.design_h).toBe(1440);
    expect(layout.panes[0]).toMatchObject({
      pk: "c1",
      x: 0,
      y: 0,
      w: 240,
      h: 120
    });
  });

  it("readFreeLayout：缺省画幅回落，窗格原样拷贝（渲染侧只读）", () => {
    expect(readFreeLayout()).toEqual({
      design: FREE_DESIGN_DEFAULTS,
      panes: []
    });
    const raw = {
      design_w: 3840,
      design_h: 2160,
      panes: [pane("c1", { x: 1, y: 2, w: 240, h: 120 })]
    };
    const read = readFreeLayout(raw);
    expect(read.design).toEqual({ design_w: 3840, design_h: 2160 });
    // 窗格为只读消费：数组另起一份（改动不回流到接口数据），元素原样
    expect(read.panes).not.toBe(raw.panes);
    expect(read.panes).toEqual(raw.panes);
  });

  it("默认尺寸覆盖全部类型且都能放进缺省画幅", () => {
    Object.values(FREE_PANE_DEFAULTS).forEach(({ w, h }) => {
      expect(w).toBeGreaterThanOrEqual(FREE_MIN_PANE_SIZE);
      expect(h).toBeGreaterThanOrEqual(FREE_MIN_PANE_SIZE);
      expect(w).toBeLessThanOrEqual(FREE_DESIGN_DEFAULTS.design_w);
      expect(h).toBeLessThanOrEqual(FREE_DESIGN_DEFAULTS.design_h);
    });
  });
});
