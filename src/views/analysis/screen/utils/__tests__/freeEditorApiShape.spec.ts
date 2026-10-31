import { describe, expect, it, vi } from "vitest";
import type { DashboardItem, DatasetItem } from "@/api/dataset/datasets";

vi.mock("@/utils/message", () => ({ message: vi.fn() }));
vi.mock("@/router/utils", () => ({ hasAuth: () => true }));
vi.mock("../serverTemplates", () => ({
  fetchServerTemplates: vi.fn(async () => []),
  saveServerTemplate: vi.fn(async () => ({ ok: true, detail: "" })),
  renameServerTemplate: vi.fn(async () => ({ ok: true, detail: "" })),
  removeServerTemplate: vi.fn(async () => true),
  fetchTemplateVersions: vi.fn(async () => []),
  rollbackTemplate: vi.fn(async () => ({ pk: "t1", name: "回滚后" })),
  fetchCloudClipboard: vi.fn(async () => null),
  saveCloudClipboard: vi.fn(async () => true),
  clearCloudClipboard: vi.fn(async () => true)
}));
vi.mock("@/utils/download", () => ({ downloadTextFile: vi.fn(() => true) }));

import { createApp, defineComponent, h, ref } from "vue";
import { createFreeEditor, type FreeEditorApi } from "../createFreeEditor";

/** 拆分后对外 API 形状守护：组合层（designer / 工具条）零改动 */
const API_KEYS = [
  "design",
  "panes",
  "selection",
  "selectionCount",
  "selectedPk",
  "primaryPane",
  "singleSelected",
  "hasClipboard",
  "gridSnap",
  "setGrid",
  "zoom",
  "autoFit",
  "steps",
  "setZoom",
  "fitToView",
  "onWheel",
  "zoomIn",
  "zoomOut",
  "load",
  "toPayload",
  "selectPk",
  "selectMany",
  "selectAll",
  "clearSelection",
  "addPane",
  "removePk",
  "removeSelected",
  "updatePane",
  "updateMany",
  "onGroupMove",
  "onBoxStop",
  "onDrop",
  "nudge",
  "align",
  "distribute",
  "alignToGrid",
  "moveLayer",
  "duplicate",
  "copy",
  "paste",
  "pasteFromCloud",
  "clearCloud",
  "templates",
  "serverTemplates",
  "refreshTemplates",
  "refreshServerTemplates",
  "saveCurrentAsTemplate",
  "saveCurrentToServer",
  "applyTemplate",
  "renameSavedTemplate",
  "renameServerTemplate",
  "removeSavedTemplate",
  "removeServerTemplate",
  "importTemplateJson",
  "exportSavedTemplate",
  "templateVersions",
  "rollbackTemplate"
];

function mountEditor(): FreeEditorApi {
  const bag: { api?: FreeEditorApi } = {};
  const host = defineComponent({
    setup() {
      const api = createFreeEditor({
        t: key => key,
        markDirty: () => undefined,
        pushHistory: () => undefined,
        dashboards: ref([{ pk: "dash-1" }] as DashboardItem[]),
        datasets: ref([{ pk: "data-1" }] as DatasetItem[]),
        viewport: ref(undefined)
      });
      api.load();
      bag.api = api;
      return () => h("div");
    }
  });
  createApp(host).mount(document.createElement("div"));
  return bag.api!;
}

describe("自由画布编辑域：对外 API 形状", () => {
  it("拆分后仍暴露原有全部键（组合层零改动）", () => {
    const api = mountEditor();
    for (const key of API_KEYS) {
      expect(api).toHaveProperty(key);
    }
  });
});
