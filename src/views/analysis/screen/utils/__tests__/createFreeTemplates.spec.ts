import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/message", () => ({ message: vi.fn() }));
vi.mock("@/utils/download", () => ({ downloadTextFile: vi.fn(() => true) }));
vi.mock("../serverTemplates", () => ({
  fetchServerTemplates: vi.fn(async () => []),
  saveServerTemplate: vi.fn(async () => true),
  renameServerTemplate: vi.fn(async () => true),
  removeServerTemplate: vi.fn(async () => true),
  fetchTemplateVersions: vi.fn(async () => []),
  rollbackTemplate: vi.fn(async () => ({ pk: "t1", name: "回滚后" })),
  fetchCloudClipboard: vi.fn(async () => null),
  saveCloudClipboard: vi.fn(async () => true),
  clearCloudClipboard: vi.fn(async () => true)
}));

import { message } from "@/utils/message";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import type { DashboardItem, DatasetItem } from "@/api/dataset/datasets";
import { createFreeTemplates } from "../createFreeTemplates";
import { createPaneInserter } from "../freeInserter";
import { FREE_DESIGN_DEFAULTS, FREE_MAX_PANES } from "../freeLayout";
import { FREE_TEMPLATE_KEY, saveTemplate } from "../freeTemplates";
import { screenStorageKey } from "../screenStorage";

/**
 * 模板域（应用 / 导入的替换与追加语义）：用**真实插入链路**（createPaneInserter）
 * 驱动，钉住两处修复——
 * - 替换应用「先插入成功再落画幅」：插入失败（引用不可见）不动画幅与窗格；
 * - 替换按全量画幅容量取模板：满画布替换不再被剩余容量截断。
 */

const pane = (
  pk: string,
  box: { x: number; y: number; w: number; h: number },
  type: ScreenLayoutPane["type"] = "text",
  extra: Partial<ScreenLayoutPane> = {}
): ScreenLayoutPane => ({ pk, type, ...box, ...extra }) as ScreenLayoutPane;

function setup(
  panes: ScreenLayoutPane[] = [],
  dashboards: DashboardItem[] = []
) {
  const design = ref({ ...FREE_DESIGN_DEFAULTS });
  const paneList = ref<ScreenLayoutPane[]>(panes);
  const selection = ref<string[]>([]);
  const dashboardsRef = ref(dashboards);
  const inserter = createPaneInserter({
    t: key => key,
    panes: paneList,
    selection,
    design,
    dashboards: dashboardsRef,
    datasets: ref([{ pk: "data-1" }] as DatasetItem[]),
    pushHistory: vi.fn(),
    markDirty: vi.fn()
  });
  const api = createFreeTemplates({
    t: key => key,
    design,
    panes: paneList,
    selection,
    inserter
  });
  return { api, design, paneList, dashboardsRef };
}

describe("自由画布模板域：替换应用的顺序与容量", () => {
  beforeEach(() => {
    vi.mocked(message).mockClear();
    localStorage.removeItem(screenStorageKey(FREE_TEMPLATE_KEY));
  });

  it("替换应用：先插入成功再落画幅（插入失败不动画幅与窗格）", () => {
    saveTemplate({
      name: "大画幅",
      design: { design_w: 2560, design_h: 1440 },
      panes: [
        pane("p1", { x: 0, y: 0, w: 480, h: 320 }, "dashboard", {
          dashboard: "dash-1"
        })
      ],
      pks: ["p1"]
    });
    const { api, design, paneList } = setup([], []);
    api.refresh();
    const mine = api.templates.value.find(item => !item.builtin)!;

    // 引用不可见 → 插入 0：画幅与窗格保持原样（失败不动作，可回头的最小保证）
    expect(api.apply(mine.id, "replace")).toBe(false);
    expect(design.value).toEqual(FREE_DESIGN_DEFAULTS);
    expect(paneList.value).toEqual([]);
    expect(vi.mocked(message)).toHaveBeenCalledWith(
      "dataScreen.pasteNothing",
      expect.anything()
    );
  });

  it("替换应用成功：画幅采纳模板画幅且夹取按目标画幅算；追加不动画幅", () => {
    saveTemplate({
      name: "大画幅",
      design: { design_w: 2560, design_h: 1440 },
      panes: [pane("p1", { x: 2500, y: 1400, w: 60, h: 60 })],
      pks: ["p1"]
    });
    const { api, design, paneList } = setup([], []);
    api.refresh();
    const mine = api.templates.value.find(item => !item.builtin)!;

    expect(api.apply(mine.id, "replace")).toBe(true);
    expect(design.value).toEqual({ design_w: 2560, design_h: 1440 });
    // 贴近画幅右下角的窗格按新画幅夹取（层叠偏移 24px 使 y 贴到 1440-60）：
    // 若先插后改画幅（旧序），会被夹进 1920×1080（x=1860 / y=1020）
    expect(paneList.value[0]).toMatchObject({ x: 2500, y: 1380 });

    // 追加模式：画幅保持当前值
    expect(api.apply(mine.id, "append")).toBe(true);
    expect(design.value).toEqual({ design_w: 2560, design_h: 1440 });
    expect(paneList.value).toHaveLength(2);
  });

  it("替换应用不受剩余容量截断（满画布也能整体替换）；追加仍按剩余容量截断", () => {
    const fill = Array.from({ length: FREE_MAX_PANES - 1 }, (_, index) =>
      pane(`f${index}`, { x: 10, y: 10, w: 80, h: 80 })
    );
    const { api, paneList } = setup(fill, []); // 59 个窗格：剩余容量只剩 1
    api.refresh();

    // 追加：按剩余容量截断（3 个模板窗格只插入 1 个）
    expect(api.apply("builtin-promo", "append")).toBe(true);
    expect(paneList.value).toHaveLength(FREE_MAX_PANES);

    // 替换：按全量画幅容量取模板，不再被剩余容量截断
    vi.mocked(message).mockClear();
    expect(api.apply("builtin-promo", "replace")).toBe(true);
    expect(paneList.value).toHaveLength(3);
    expect(vi.mocked(message)).not.toHaveBeenCalledWith(
      "dataScreen.insertTruncated",
      expect.anything()
    );
  });

  it("导入 JSON：解析丢弃的窗格计数提示（未知类型 / 缺必填项不静默丢）", () => {
    const { api, paneList } = setup([], []);
    const raw = JSON.stringify({
      name: "导入",
      panes: [
        pane("p1", { x: 0, y: 0, w: 400, h: 200 }, "text", { text: "标题" }),
        { type: "nope", x: 0, y: 0, w: 100, h: 100 }, // 未知类型
        { type: "video", x: 0, y: 0, w: 100, h: 100 } // 缺地址
      ]
    });
    expect(api.importJson(raw, "append")).toBe(true);
    expect(paneList.value).toHaveLength(1);
    expect(vi.mocked(message)).toHaveBeenCalledWith(
      "dataScreen.templateImportSkipped",
      expect.objectContaining({ type: "warning" })
    );
    expect(vi.mocked(message)).toHaveBeenCalledWith(
      "dataScreen.templateImported",
      expect.objectContaining({ type: "success" })
    );
  });

  it("导入 JSON 替换：先插入成功再落画幅（全部不可插入时不动画幅）", () => {
    const { api, design, paneList } = setup([], []);
    const raw = JSON.stringify({
      design: { design_w: 3840, design_h: 2160 },
      panes: [
        pane("p1", { x: 0, y: 0, w: 480, h: 320 }, "dashboard", {
          dashboard: "dash-gone"
        })
      ]
    });
    expect(api.importJson(raw, "replace")).toBe(false);
    expect(design.value).toEqual(FREE_DESIGN_DEFAULTS);
    expect(paneList.value).toEqual([]);
  });
});
