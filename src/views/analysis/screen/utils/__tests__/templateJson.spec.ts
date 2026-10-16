import { describe, expect, it } from "vitest";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import { FREE_DESIGN_DEFAULTS, FREE_MAX_PANES } from "../freeLayout";
import { FREE_MIN_PANE_SIZE } from "../freeLayout";
import {
  TEMPLATE_JSON_MAX_BYTES,
  exportTemplateJson,
  parseTemplateJson
} from "../templateJson";

const pane = (extra: Partial<ScreenLayoutPane> = {}): ScreenLayoutPane =>
  ({
    pk: "p1",
    type: "text",
    x: 100,
    y: 120,
    w: 400,
    h: 200,
    text: "标题",
    ...extra
  }) as ScreenLayoutPane;

describe("parseTemplateJson", () => {
  it("解析对象载荷：画幅 / 名称 / 窗格，并换新 pk", () => {
    const raw = JSON.stringify({
      version: 1,
      name: "宣传屏",
      design: { design_w: 3840, design_h: 2160 },
      panes: [pane()]
    });
    const result = parseTemplateJson(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("宣传屏");
    expect(result.value.design).toEqual({ design_w: 3840, design_h: 2160 });
    expect(result.value.skipped).toBe(0);
    expect(result.value.panes[0].pk).not.toBe("p1");
    expect(result.value.panes[0]).toMatchObject({
      type: "text",
      x: 100,
      y: 120,
      w: 400,
      h: 200,
      text: "标题"
    });
  });

  it("也吃「窗格数组」形式的简写文件", () => {
    const result = parseTemplateJson(JSON.stringify([pane()]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("");
    expect(result.value.design).toEqual(FREE_DESIGN_DEFAULTS);
    expect(result.value.panes).toHaveLength(1);
  });

  it("越界坐标夹回画幅、缺失尺寸夹到下限", () => {
    const raw = JSON.stringify({
      design: { design_w: 1280, design_h: 720 },
      panes: [pane({ x: 1200, y: 700, w: 400, h: 4 })]
    });
    const result = parseTemplateJson(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [created] = result.value.panes;
    expect(created.x + created.w).toBeLessThanOrEqual(1280);
    expect(created.y + created.h).toBeLessThanOrEqual(720);
    expect(created.w).toBeGreaterThanOrEqual(FREE_MIN_PANE_SIZE);
    expect(created.h).toBeGreaterThanOrEqual(FREE_MIN_PANE_SIZE);
  });

  it("形状不合法的窗格被丢弃并计数（不写半成品）", () => {
    const raw = JSON.stringify({
      panes: [
        pane(),
        { type: "text" }, // 缺坐标
        { type: "nope", x: 0, y: 0, w: 100, h: 100 }, // 未知类型
        { type: "dashboard", x: 0, y: 0, w: 100, h: 100 }, // 缺仪表盘引用
        { type: "metric", x: 0, y: 0, w: 100, h: 100 }, // 缺数据集引用
        { type: "image", x: 0, y: 0, w: 100, h: 100 } // 缺图片地址
      ]
    });
    const result = parseTemplateJson(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.panes).toHaveLength(1);
    expect(result.value.skipped).toBe(5);
  });

  it("超出数量上限按上限截断并计入 skipped", () => {
    const raw = JSON.stringify({
      panes: Array.from({ length: FREE_MAX_PANES + 3 }, () => pane())
    });
    const result = parseTemplateJson(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.panes).toHaveLength(FREE_MAX_PANES);
    expect(result.value.skipped).toBe(3);
  });

  it("非法输入给可读错误：非 JSON / 无窗格 / 过大", () => {
    expect(parseTemplateJson("{")).toEqual({ ok: false, error: "format" });
    expect(parseTemplateJson(JSON.stringify({ name: "空" }))).toEqual({
      ok: false,
      error: "format"
    });
    expect(parseTemplateJson(JSON.stringify({ panes: [] }))).toEqual({
      ok: false,
      error: "empty"
    });
    expect(parseTemplateJson(JSON.stringify({ panes: [{}] }))).toEqual({
      ok: false,
      error: "empty"
    });
    expect(parseTemplateJson("x".repeat(TEMPLATE_JSON_MAX_BYTES + 1))).toEqual({
      ok: false,
      error: "too-large"
    });
  });
});

describe("导出 → 导入往返", () => {
  it("导出再导入结构与位置一致（pk 换新、画幅保留）", () => {
    const json = exportTemplateJson({
      name: "往返",
      design: { design_w: 2560, design_h: 1440 },
      panes: [pane(), pane({ pk: "p2", type: "clock", x: 800, y: 100 })]
    });
    expect(JSON.parse(json).version).toBe(1);
    const result = parseTemplateJson(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("往返");
    expect(result.value.design).toEqual({ design_w: 2560, design_h: 1440 });
    expect(result.value.panes.map(item => item.type)).toEqual([
      "text",
      "clock"
    ]);
    expect(result.value.panes.map(item => [item.x, item.y])).toEqual([
      [100, 120],
      [800, 100]
    ]);
    expect(new Set(result.value.panes.map(item => item.pk)).size).toBe(2);
  });
});
