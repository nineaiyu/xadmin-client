import { describe, expect, it } from "vitest";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import { alignBoxes, distributeBoxes } from "../freeAlign";

const DESIGN = { design_w: 1920, design_h: 1080 };

const pane = (
  pk: string,
  box: { x: number; y: number; w: number; h: number }
): ScreenLayoutPane => ({ pk, type: "text", ...box });

const A = pane("a", { x: 100, y: 100, w: 200, h: 100 });
const B = pane("b", { x: 400, y: 200, w: 300, h: 150 });
const C = pane("c", { x: 1000, y: 900, w: 100, h: 100 });
const PANES = [A, B, C];
const ALL = ["a", "b", "c"];

describe("对齐：基准 = 选区包围盒", () => {
  it("左 / 右 / 水平居中", () => {
    // 包围盒 x=100..1100
    expect(alignBoxes(PANES, ALL, "left", DESIGN).a.x).toBe(100);
    expect(alignBoxes(PANES, ALL, "left", DESIGN).b.x).toBe(100);
    expect(alignBoxes(PANES, ALL, "right", DESIGN).a.x).toBe(900);
    expect(alignBoxes(PANES, ALL, "right", DESIGN).c.x).toBe(1000);
    expect(alignBoxes(PANES, ALL, "hcenter", DESIGN).b.x).toBe(450);
  });

  it("上 / 下 / 垂直居中", () => {
    // 包围盒 y=100..1000
    expect(alignBoxes(PANES, ALL, "top", DESIGN).b.y).toBe(100);
    expect(alignBoxes(PANES, ALL, "bottom", DESIGN).b.y).toBe(850);
    expect(alignBoxes(PANES, ALL, "vcenter", DESIGN).c.y).toBe(500);
  });

  it("单选时基准 = 整幅画布（等价对齐到画布）", () => {
    expect(alignBoxes(PANES, ["a"], "left", DESIGN).a.x).toBe(0);
    expect(alignBoxes(PANES, ["a"], "right", DESIGN).a.x).toBe(1720);
    expect(alignBoxes(PANES, ["a"], "hcenter", DESIGN).a.x).toBe(860);
    expect(alignBoxes(PANES, ["a"], "bottom", DESIGN).a.y).toBe(980);
    expect(alignBoxes(PANES, ["a"], "vcenter", DESIGN).a.y).toBe(490);
  });

  it("只改一个轴，另一个轴与尺寸保持不动；空选区返回空对象", () => {
    const box = alignBoxes(PANES, ["b"], "left", DESIGN).b;
    expect(box).toEqual({ x: 0, y: B.y, w: B.w, h: B.h });
    expect(alignBoxes(PANES, [], "left", DESIGN)).toEqual({});
  });

  it("结果夹回画幅（超大窗格居中后不越界）", () => {
    const wide = pane("wide", { x: 0, y: 0, w: 1900, h: 100 });
    const box = alignBoxes([wide], ["wide"], "hcenter", DESIGN).wide;
    expect(box.x).toBe(10);
    expect(box.x + box.w).toBeLessThanOrEqual(DESIGN.design_w);
  });
});

describe("分布：两端不动、中间均分边距", () => {
  it("水平：首尾不动，中间按边距均分", () => {
    const result = distributeBoxes(PANES, ALL, "h", DESIGN);
    expect(result.a.x).toBe(100);
    expect(result.b.x).toBe(500);
    expect(result.c.x).toBe(1000);
  });

  it("垂直：首尾不动，中间按边距均分", () => {
    const result = distributeBoxes(PANES, ALL, "v", DESIGN);
    expect(result.a.y).toBe(100);
    expect(result.b.y).toBe(475);
    expect(result.c.y).toBe(900);
  });

  it("少于 3 个窗格时不做分布（无意义的「均分」）", () => {
    expect(distributeBoxes(PANES, ["a", "b"], "h", DESIGN)).toEqual({});
    expect(distributeBoxes(PANES, ["a"], "h", DESIGN)).toEqual({});
  });
});
