import { beforeEach, describe, expect, it } from "vitest";
import type { ScreenLayoutPane, ScreenPaneType } from "@/api/dataset/analysis";
import type { DashboardItem, DatasetItem } from "@/api/dataset/datasets";
import {
  FREE_CLIPBOARD_KEY,
  FREE_PASTE_OFFSET,
  clearClipboard,
  createClipboard,
  insertPanes,
  readClipboard,
  writeClipboard
} from "../freeClipboard";
import { screenStorageKey } from "../screenStorage";

const DESIGN = { design_w: 1920, design_h: 1080 };

const pane = (
  pk: string,
  box: { x: number; y: number; w: number; h: number },
  type: ScreenPaneType = "text"
): ScreenLayoutPane => ({ pk, type, ...box });

const REF = pane("ref", { x: 100, y: 100, w: 200, h: 100 });

const dashboards = [{ pk: "dash-1" }] as DashboardItem[];
const datasets = [{ pk: "data-1" }] as DatasetItem[];

const insert = (source: ScreenLayoutPane[], limit = 60) =>
  insertPanes({ source, design: DESIGN, dashboards, datasets, limit });

describe("剪贴板读写", () => {
  beforeEach(() => {
    clearClipboard();
  });

  it("空选区不产生载荷；打包后可按原样读回", () => {
    expect(createClipboard([REF], [], DESIGN)).toBeNull();
    const payload = createClipboard(
      [REF, pane("b", { x: 0, y: 0, w: 16, h: 16 })],
      ["ref", "b"],
      DESIGN
    );
    expect(payload?.version).toBe(1);
    expect(payload?.panes).toHaveLength(2);
    expect(payload?.design).toEqual(DESIGN);
    expect(writeClipboard(payload!)).toBe(true);

    const read = readClipboard();
    expect(read?.panes.map(item => item.pk)).toEqual(["ref", "b"]);
  });

  it("版本不符 / 载荷被改坏 / 空列表一律视为无剪贴板", () => {
    localStorage.setItem(
      screenStorageKey(FREE_CLIPBOARD_KEY),
      JSON.stringify({ version: 99, panes: [REF] })
    );
    expect(readClipboard()).toBeNull();

    localStorage.setItem(screenStorageKey(FREE_CLIPBOARD_KEY), "{ not json");
    expect(readClipboard()).toBeNull();

    localStorage.setItem(
      screenStorageKey(FREE_CLIPBOARD_KEY),
      JSON.stringify({ version: 1, panes: [] })
    );
    expect(readClipboard()).toBeNull();
  });
});

describe("插入链路（粘贴 / 复制 / 模板共用）", () => {
  it("层叠偏移 + 新 pk + 只保留声明键", () => {
    const dirty = { ...REF, junk: "drop-me" } as ScreenLayoutPane;
    const { panes, summary } = insert([dirty]);
    expect(summary).toEqual({ inserted: 1, skippedRefs: 0, truncated: 0 });
    expect(panes[0]).toMatchObject({
      type: "text",
      x: REF.x + FREE_PASTE_OFFSET,
      y: REF.y + FREE_PASTE_OFFSET,
      w: REF.w,
      h: REF.h
    });
    expect(panes[0].pk).not.toBe(REF.pk);
    expect(panes[0]).not.toHaveProperty("junk");
  });

  it("越界就地夹回画幅（含 offset 后仍不越界）", () => {
    const edge = pane("edge", { x: 1900, y: 1000, w: 120, h: 80 });
    const box = insert([edge]).panes[0];
    expect(box.x).toBe(DESIGN.design_w - 120);
    expect(box.y).toBe(DESIGN.design_h - 80);
  });

  it("引用不可见的窗格被丢弃并计数（服务端会拒，提前丢）", () => {
    const source = [
      pane("ok-dash", { x: 0, y: 0, w: 100, h: 100 }, "dashboard"),
      pane("bad-dash", { x: 0, y: 0, w: 100, h: 100 }, "dashboard"),
      pane("ok-metric", { x: 0, y: 0, w: 100, h: 100 }, "metric"),
      pane("bad-metric", { x: 0, y: 0, w: 100, h: 100 }, "metric"),
      REF
    ];
    source[0].dashboard = "dash-1";
    source[1].dashboard = "dash-gone";
    source[2].dataset = "data-1";
    source[3].dataset = "data-gone";
    const { panes, summary } = insert(source);
    expect(summary.inserted).toBe(3);
    expect(summary.skippedRefs).toBe(2);
    expect(panes.map(item => item.pk)).toHaveLength(3);
  });

  it("超出数量上限时截断并计数", () => {
    const source = [
      REF,
      pane("b", { x: 0, y: 0, w: 16, h: 16 }),
      pane("c", { x: 0, y: 0, w: 16, h: 16 })
    ];
    expect(insert(source, 2).summary).toEqual({
      inserted: 2,
      skippedRefs: 0,
      truncated: 1
    });
    expect(insert(source, 0)).toMatchObject({
      panes: [],
      summary: { inserted: 0, skippedRefs: 0, truncated: 3 }
    });
  });
});
