import { describe, expect, it } from "vitest";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import {
  GRID_COLS,
  GRID_MAX_ROWS,
  MAX_PANES,
  PANE_DEFAULTS,
  canPlace,
  cellFromOffset,
  clampBox,
  findSlot,
  genPaneId,
  normalizePanes,
  overlaps
} from "../layout";

const pane = (
  pk: string,
  box: { x: number; y: number; w: number; h: number },
  type: ScreenLayoutPane["type"] = "clock"
): ScreenLayoutPane => ({ pk, type, ...box });

describe("栅格几何口径", () => {
  it("边界相接不算重叠，部分/完全重叠都算", () => {
    expect(
      overlaps({ x: 0, y: 0, w: 6, h: 3 }, { x: 6, y: 0, w: 6, h: 3 })
    ).toBe(false);
    expect(
      overlaps({ x: 0, y: 0, w: 6, h: 3 }, { x: 5, y: 2, w: 6, h: 3 })
    ).toBe(true);
    expect(
      overlaps({ x: 0, y: 0, w: 6, h: 3 }, { x: 0, y: 0, w: 6, h: 3 })
    ).toBe(true);
  });

  it("clampBox 就地吸附到栅格内（越界不报错）", () => {
    expect(clampBox({ x: -3, y: -2, w: 6, h: 4 })).toEqual({
      x: 0,
      y: 0,
      w: 6,
      h: 4
    });
    expect(clampBox({ x: 10, y: 5, w: 6, h: 4 })).toEqual({
      x: 6,
      y: 5,
      w: 6,
      h: 4
    });
    // 宽度超过整行时收敛到整行
    expect(clampBox({ x: 0, y: 0, w: 30, h: 1 })).toEqual({
      x: 0,
      y: 0,
      w: GRID_COLS,
      h: 1
    });
    expect(clampBox({ x: 0, y: 100, w: 3, h: 10 })).toEqual({
      x: 0,
      y: GRID_MAX_ROWS - 10,
      w: 3,
      h: 10
    });
  });

  it("canPlace 忽略自身下标（移动窗格时不与自己冲突）", () => {
    const panes = [pane("a", { x: 0, y: 0, w: 6, h: 4 })];
    expect(canPlace(panes, { x: 2, y: 0, w: 6, h: 4 })).toBe(false);
    expect(canPlace(panes, { x: 2, y: 0, w: 6, h: 4 }, 0)).toBe(true);
  });

  it("findSlot 行优先找首个空位，画布占满返回 null", () => {
    const panes = [pane("a", { x: 0, y: 0, w: 12, h: 2 })];
    expect(findSlot(panes, 6, 4)).toEqual({ x: 0, y: 2, w: 6, h: 4 });

    const full = Array.from({ length: 12 }, (_, row) =>
      pane(`row-${row}`, { x: 0, y: row * 5, w: 12, h: 5 })
    );
    expect(findSlot(full, 6, 4)).toBeNull();
  });

  it("findSlot 放不下时按 clamp 后的尺寸找位（超宽收敛为整行）", () => {
    expect(findSlot([], 30, 1)).toEqual({ x: 0, y: 0, w: GRID_COLS, h: 1 });
  });

  it("cellFromOffset 把指针偏移换算为栅格下标并夹在范围内", () => {
    const metrics = { cellW: 100, cellH: 80, gapX: 16, gapY: 16 };
    expect(cellFromOffset(0, 0, metrics)).toEqual({ x: 0, y: 0 });
    // 第 2 格中心（100+16=116 步长）
    expect(cellFromOffset(120, 90, metrics)).toEqual({ x: 1, y: 1 });
    // 分界点 = 单元格尺寸 + gap 的一半（x：100+8=108，y：80+8=88）：之前归左/上，之后归右/下
    expect(cellFromOffset(107, 87, metrics)).toEqual({ x: 0, y: 0 });
    expect(cellFromOffset(108, 88, metrics)).toEqual({ x: 1, y: 1 });
    // 越界夹回
    expect(cellFromOffset(99999, 99999, metrics)).toEqual({
      x: GRID_COLS - 1,
      y: GRID_MAX_ROWS - 1
    });
    expect(cellFromOffset(-50, -50, metrics)).toEqual({ x: 0, y: 0 });
  });

  it("normalizePanes 只保留服务端声明键并按类型补默认值", () => {
    const panes: ScreenLayoutPane[] = [
      pane("d1", { x: 0, y: 0, w: 6, h: 4 }, "dashboard"),
      pane("t1", { x: 0, y: 4, w: 12, h: 2 }, "text"),
      pane("c1", { x: 0, y: 6, w: 3, h: 2 })
    ];
    panes[0].dashboard = "dash-1";
    const normalised = normalizePanes(panes);
    expect(normalised[0]).toEqual({
      pk: "d1",
      type: "dashboard",
      x: 0,
      y: 0,
      w: 6,
      h: 4,
      dashboard: "dash-1"
    });
    expect(normalised[1]).toMatchObject({
      pk: "t1",
      type: "text",
      text: "",
      align: "left",
      size: 24
    });
    // clock 补默认字号（与投屏渲染口径一致）
    expect(normalised[2]).toEqual({
      pk: "c1",
      type: "clock",
      x: 0,
      y: 6,
      w: 3,
      h: 2,
      size: 40
    });
  });

  it("normalizePanes 指标卡：count 丢 value_field，sum 保留", () => {
    const metric: ScreenLayoutPane = {
      pk: "m1",
      type: "metric",
      x: 0,
      y: 0,
      w: 3,
      h: 2,
      dataset: "ds-1",
      metric: "sum",
      value_field: "amount",
      title: "销售额"
    };
    expect(normalizePanes([metric])[0]).toEqual({
      pk: "m1",
      type: "metric",
      x: 0,
      y: 0,
      w: 3,
      h: 2,
      dataset: "ds-1",
      metric: "sum",
      value_field: "amount",
      title: "销售额"
    });
    metric.metric = "count";
    expect(normalizePanes([metric])[0]).not.toHaveProperty("value_field");
    expect(normalizePanes([metric])[0]).toMatchObject({ metric: "count" });
  });

  it("normalizePanes 图片：补默认填充方式", () => {
    const image: ScreenLayoutPane = {
      pk: "i1",
      type: "image",
      x: 0,
      y: 0,
      w: 3,
      h: 3,
      url: "https://a.b/c.png"
    };
    expect(normalizePanes([image])[0]).toEqual({
      pk: "i1",
      type: "image",
      x: 0,
      y: 0,
      w: 3,
      h: 3,
      url: "https://a.b/c.png",
      fit: "cover"
    });
  });

  it("默认尺寸覆盖全部类型且都在栅格内", () => {
    Object.values(PANE_DEFAULTS).forEach(({ w, h }) => {
      expect(w).toBeGreaterThan(0);
      expect(w).toBeLessThanOrEqual(GRID_COLS);
      expect(h).toBeGreaterThan(0);
      expect(h).toBeLessThanOrEqual(GRID_MAX_ROWS);
    });
    expect(MAX_PANES).toBeGreaterThan(Object.keys(PANE_DEFAULTS).length);
  });

  it("genPaneId 生成稳定前缀的唯一标识", () => {
    const first = genPaneId();
    const second = genPaneId();
    expect(first.startsWith("pane-")).toBe(true);
    expect(first).not.toBe(second);
  });
});
