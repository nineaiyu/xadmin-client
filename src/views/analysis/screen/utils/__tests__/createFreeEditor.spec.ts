import { nextTick, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import type { DashboardItem, DatasetItem } from "@/api/dataset/datasets";

vi.mock("@/utils/message", () => ({ message: vi.fn() }));
vi.mock("@/router/utils", () => ({ hasAuth: () => true }));
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
vi.mock("@/utils/download", () => ({ downloadTextFile: vi.fn(() => true) }));

import { message } from "@/utils/message";
import { createFreeEditor, type FreeEditorApi } from "../createFreeEditor";
import { FREE_MAX_PANES } from "../freeLayout";
import { clearClipboard } from "../freeClipboard";
import { FREE_TEMPLATE_KEY } from "../freeTemplates";
import { screenStorageKey } from "../screenStorage";

const pane = (
  pk: string,
  box: { x: number; y: number; w: number; h: number },
  type: ScreenLayoutPane["type"] = "text"
): ScreenLayoutPane => ({ pk, type, ...box });

const PANES = [
  pane("a", { x: 100, y: 100, w: 200, h: 100 }),
  pane("b", { x: 400, y: 200, w: 300, h: 150 }),
  pane("c", { x: 1000, y: 900, w: 100, h: 100 })
];

/** 组合层依赖 onMounted / watch：用最小宿主组件承载（与 hook.spec 同口径） */
async function setup(initial: ScreenLayoutPane[] = PANES) {
  const { createApp, defineComponent, h } = await import("vue");
  const pushes: string[] = [];
  const dirty: number[] = [];
  const bag: { api?: FreeEditorApi } = {};
  const host = defineComponent({
    setup(_, { expose }) {
      const api = createFreeEditor({
        t: key => key,
        markDirty: () => dirty.push(1),
        pushHistory: (key?: string) => pushes.push(key ?? ""),
        dashboards: ref([{ pk: "dash-1" }] as DashboardItem[]),
        datasets: ref([{ pk: "data-1" }] as DatasetItem[]),
        viewport: ref(undefined)
      });
      api.load({ design_w: 1920, design_h: 1080, panes: initial });
      bag.api = api;
      expose(api);
      return () => h("div");
    }
  });
  const app = createApp(host);
  app.mount(document.createElement("div"));
  await nextTick();
  return { api: bag.api!, pushes, dirty };
}

const boxes = (api: FreeEditorApi) =>
  Object.fromEntries(
    api.panes.value.map(item => [item.pk, `${item.x},${item.y}`])
  );

describe("自由画布编辑域：选择模型", () => {
  it("单选 / 加选 / 减选 / 全选 / 清空，主选取选区内末位", async () => {
    const { api } = await setup();
    api.selectPk("a");
    expect(api.selection.value).toEqual(["a"]);
    expect(api.selectedPk.value).toBe("a");
    expect(api.singleSelected.value?.pk).toBe("a");

    api.selectPk("b", true);
    expect(api.selection.value).toEqual(["a", "b"]);
    expect(api.selectedPk.value).toBe("b");
    // 多选下没有单选目标（属性面板切多选面板）
    expect(api.singleSelected.value).toBeUndefined();

    // 点在已选项上 = 减选
    api.selectPk("a", true);
    expect(api.selection.value).toEqual(["b"]);

    api.selectAll();
    expect(api.selection.value).toEqual(["a", "b", "c"]);
    api.clearSelection();
    expect(api.selection.value).toEqual([]);
  });

  it("框选结果：追加并入 / 默认替换", async () => {
    const { api } = await setup();
    api.selectPk("a");
    api.selectMany(["b", "c"], true);
    expect(api.selection.value).toEqual(["a", "b", "c"]);
    api.selectMany(["c"]);
    expect(api.selection.value).toEqual(["c"]);
  });
});

describe("自由画布编辑域：手势与撤销点", () => {
  it("组拖动：写数据 + 只记一个撤销点，停手不再补记", async () => {
    const { api, pushes } = await setup();
    api.selectMany(["a", "b"]);
    api.onGroupMove({
      pk: "a",
      boxes: {
        a: { x: 140, y: 130, w: 200, h: 100 },
        b: { x: 440, y: 230, w: 300, h: 150 }
      }
    });
    expect(pushes).toHaveLength(1);
    expect(boxes(api)).toMatchObject({ a: "140,130", b: "440,230" });

    // 停手回传同一位置：不产生第二个撤销点
    api.onBoxStop({
      pk: "a",
      box: { x: 140, y: 130, w: 200, h: 100 },
      gesture: "move"
    });
    expect(pushes).toHaveLength(1);
  });

  it("单格手势位移为 0 不记撤销点；有位移记一个", async () => {
    const { api, pushes } = await setup();
    api.selectPk("a");
    api.onBoxStop({
      pk: "a",
      box: { x: 100, y: 100, w: 200, h: 100 },
      gesture: "move"
    });
    expect(pushes).toHaveLength(0);

    api.onBoxStop({
      pk: "a",
      box: { x: 180, y: 160, w: 200, h: 100 },
      gesture: "move"
    });
    expect(pushes).toHaveLength(1);
    expect(api.panes.value[0]).toMatchObject({ x: 180, y: 160 });
  });

  it("方向键整组微调：Shift 为 10px 步进，贴边后整组停住且不记点", async () => {
    const { api, pushes } = await setup([
      pane("a", { x: 0, y: 100, w: 200, h: 100 }),
      pane("b", { x: 400, y: 200, w: 300, h: 150 })
    ]);
    api.selectMany(["a", "b"]);
    expect(api.nudge(1, 0, false)).toBe(true);
    expect(boxes(api)).toMatchObject({ a: "1,100", b: "401,200" });
    // Shift 步进 10px：贴边时按组夹取到边界（仍有位移），继续推则无位移返回 false
    expect(api.nudge(-1, 0, true)).toBe(true);
    expect(boxes(api)).toMatchObject({ a: "0,100", b: "400,200" });
    expect(api.nudge(-1, 0, false)).toBe(false);
    // 两次移动同合并键（历史层 800ms 内并为一步）；无位移的那次不记点
    expect(pushes).toEqual(["nudge-a,b-move", "nudge-a,b-move"]);
  });
});

describe("自由画布编辑域：对齐 / 分布 / 层级", () => {
  beforeEach(() => {
    vi.mocked(message).mockClear();
  });

  it("对齐：一次一个撤销点，无变化时不记点", async () => {
    const { api, pushes } = await setup();
    api.selectMany(["a", "b", "c"]);
    // 返回「实际被改动的窗格数」：a 已是最左，只有 b / c 需要移动
    expect(api.align("left")).toBe(2);
    expect(pushes).toHaveLength(1);
    expect(boxes(api).a.split(",")[0]).toBe("100");
    expect(boxes(api).c.split(",")[0]).toBe("100");

    // 已经左对齐：再点一次不应新增撤销点
    expect(api.align("left")).toBe(0);
    expect(pushes).toHaveLength(1);
  });

  it("分布：≥3 个才生效（两端不动、中间均分）", async () => {
    const { api, pushes } = await setup();
    api.selectMany(["a", "b", "c"]);
    // 两端（a / c）已在极值位置：只有中间 b 被移动
    expect(api.distribute("h")).toBe(1);
    expect(boxes(api).b).toBe("500,200");
    expect(pushes).toHaveLength(1);

    api.selectMany(["a", "b"]);
    expect(api.distribute("h")).toBe(0);
    expect(pushes).toHaveLength(1);
  });

  it("层级：多选整体置顶 / 置底 / 相对相邻窗格移动一位", async () => {
    const { api } = await setup();
    const order = () => api.panes.value.map(item => item.pk);
    api.selectMany(["a", "b"]);
    api.moveLayer("top");
    expect(order()).toEqual(["c", "a", "b"]);
    api.moveLayer("bottom");
    expect(order()).toEqual(["a", "b", "c"]);
    // 整组已贴底：下移无可换位（保持原序），上移则整体越过 c
    api.moveLayer("down");
    expect(order()).toEqual(["a", "b", "c"]);
    api.moveLayer("up");
    expect(order()).toEqual(["c", "a", "b"]);
  });
});

describe("自由画布编辑域：剪贴板与模板", () => {
  beforeEach(() => {
    vi.mocked(message).mockClear();
    clearClipboard();
    localStorage.removeItem(screenStorageKey(FREE_TEMPLATE_KEY));
  });

  it("复制 / 粘贴：新 pk、层叠偏移、粘贴后选中新窗格", async () => {
    const { api, pushes } = await setup();
    api.selectMany(["a", "b"]);
    expect(api.copy()).toBe(2);
    expect(api.hasClipboard.value).toBe(true);

    const inserted = api.paste();
    expect(inserted).toBe(2);
    expect(api.panes.value).toHaveLength(5);
    expect(api.selection.value).toHaveLength(2);
    expect(pushes).toHaveLength(1);
    const pasted = api.panes.value.slice(3);
    expect(pasted[0]).toMatchObject({ x: 124, y: 124, w: 200, h: 100 });
    expect(
      pasted.every(item => !PANES.some(source => source.pk === item.pk))
    ).toBe(true);
  });

  it("粘贴：引用不可见的窗格被丢弃并提示；上限截断", async () => {
    const { api } = await setup([
      pane("d", { x: 0, y: 0, w: 100, h: 100 }, "dashboard")
    ]);
    api.panes.value[0].dashboard = "dash-gone";
    api.selectPk("d");
    api.copy();
    expect(api.paste()).toBe(0);
    expect(vi.mocked(message)).toHaveBeenCalledWith(
      "dataScreen.pasteNothing",
      expect.anything()
    );
  });

  it("内置模板：替换应用（含画幅）与追加应用；应用后选中新窗格", async () => {
    const { api } = await setup();
    api.refreshTemplates();
    expect(api.templates.value.filter(item => item.builtin)).toHaveLength(3);

    expect(api.applyTemplate("builtin-promo", "replace")).toBe(true);
    expect(api.panes.value).toHaveLength(3);
    expect(api.design.value).toEqual({ design_w: 1920, design_h: 1080 });
    expect(api.selection.value).toHaveLength(3);

    expect(api.applyTemplate("builtin-report", "append")).toBe(true);
    expect(api.panes.value).toHaveLength(8);
    expect(api.applyTemplate("missing", "replace")).toBe(false);
  });

  it("保存 / 重命名 / 删除「我的模板」，错误码给出可读提示", async () => {
    const { api } = await setup();
    api.refreshTemplates();
    expect(api.saveCurrentAsTemplate("   ")).toBe(false);
    expect(api.saveCurrentAsTemplate("季报")).toBe(false);

    api.selectMany(["a", "b"]);
    expect(api.saveCurrentAsTemplate("季报")).toBe(true);
    api.refreshTemplates();
    const mine = api.templates.value.find(item => !item.builtin)!;
    expect(vi.mocked(message)).toHaveBeenCalledWith(
      "dataScreen.templateSaved",
      expect.anything()
    );

    expect(api.renameSavedTemplate(mine.id, "季度汇报")).toBe(true);
    api.refreshTemplates();
    expect(api.templates.value.find(item => item.id === mine.id)?.name).toBe(
      "季度汇报"
    );

    expect(api.removeSavedTemplate(mine.id)).toBe(true);
    api.refreshTemplates();
    expect(api.templates.value.some(item => item.id === mine.id)).toBe(false);
  });

  it("载荷装载与组装：双载荷字段只保留声明键，上限常量一致", async () => {
    const { api } = await setup([]);
    api.load({
      design_w: 2560,
      design_h: 1440,
      panes: [pane("x", { x: 1, y: 2, w: 30, h: 40 })]
    });
    expect(api.design.value).toEqual({ design_w: 2560, design_h: 1440 });
    const payload = api.toPayload();
    expect(payload.panes).toHaveLength(1);
    expect(payload.panes[0]).toMatchObject({
      pk: "x",
      x: 1,
      y: 2,
      w: 30,
      h: 40
    });
    expect(FREE_MAX_PANES).toBeGreaterThan(0);
  });
});

describe("自由画布编辑域：批量改属性（多选，统一值语义）", () => {
  it("统一写入选中窗格：不适用类型的窗格跳过（口径同服务端归一化）", async () => {
    const { api, pushes, dirty } = await setup([
      pane("t1", { x: 0, y: 0, w: 200, h: 100 }, "text"),
      pane("t2", { x: 300, y: 0, w: 200, h: 100 }, "text"),
      pane("c1", { x: 600, y: 0, w: 200, h: 100 }, "clock"),
      pane("i1", { x: 900, y: 0, w: 200, h: 100 }, "image")
    ]);
    api.selectMany(["t1", "t2", "c1", "i1"]);

    // 字号：只写字号适用的 text / clock，图片跳过
    expect(api.updateMany({ size: 48 })).toBe(3);
    const byPk = Object.fromEntries(
      api.panes.value.map(item => [item.pk, item.size])
    );
    expect(byPk.t1).toBe(48);
    expect(byPk.t2).toBe(48);
    expect(byPk.c1).toBe(48);
    expect(byPk.i1).toBeUndefined();
    expect(pushes).toHaveLength(1);
    expect(dirty).toHaveLength(1);

    // 文本格式：只写 text
    expect(api.updateMany({ text_format: "rich" })).toBe(2);
    expect(
      api.panes.value.filter(item => item.text_format === "rich")
    ).toHaveLength(2);

    // 图片填充：只写 image
    expect(api.updateMany({ fit: "contain" })).toBe(1);
    expect(api.panes.value.find(item => item.pk === "i1")?.fit).toBe("contain");
  });

  it("旋转 / 动画适用于全部类型，旋转按 -180~180 夹取", async () => {
    const { api } = await setup([
      pane("t1", { x: 0, y: 0, w: 200, h: 100 }, "text"),
      pane("i1", { x: 300, y: 0, w: 200, h: 100 }, "image")
    ]);
    api.selectMany(["t1", "i1"]);
    expect(api.updateMany({ rotate: 999 })).toBe(2);
    expect(api.panes.value.map(item => item.rotate)).toEqual([180, 180]);
    expect(api.updateMany({ animation: "fade" })).toBe(2);
    expect(api.panes.value.map(item => item.animation)).toEqual([
      "fade",
      "fade"
    ]);
  });

  it("值没变化不记撤销点；空选区 / 空 patch 返回 0", async () => {
    const { api, pushes } = await setup();
    api.selectMany(["a", "b"]);
    expect(api.updateMany({})).toBe(0);
    expect(api.updateMany({ rotate: 30 })).toBe(2);
    expect(pushes).toHaveLength(1);
    expect(api.updateMany({ rotate: 30 })).toBe(0);
    expect(pushes).toHaveLength(1);
    api.clearSelection();
    expect(api.updateMany({ rotate: 60 })).toBe(0);
  });
});

describe("自由画布编辑域：批量对齐网格", () => {
  it("坐标与尺寸落到当前步长（默认 8px），一次一个撤销点", async () => {
    const { api, pushes } = await setup([
      pane("a", { x: 103, y: 197, w: 251, h: 79 }),
      pane("b", { x: 400, y: 200, w: 300, h: 150 })
    ]);
    api.selectMany(["a", "b"]);
    // 两个都不在网格上（b 的宽高 300/150 也不是 8 的倍数）→ 都改，但仍只记一个撤销点
    expect(api.alignToGrid()).toBe(2);
    const aligned = api.panes.value.find(item => item.pk === "a")!;
    expect([aligned.x, aligned.y, aligned.w, aligned.h]).toEqual([
      104, 200, 248, 80
    ]);
    expect(pushes).toHaveLength(1);
    // 已经全在网格上 → 不再产生变更（也不记撤销点）
    api.selectMany(["a"]);
    expect(api.alignToGrid()).toBe(0);
    expect(pushes).toHaveLength(1);
  });

  it("步长随工具栏选择变化（20px：坐标与尺寸都按 20 取整）", async () => {
    const { api } = await setup([pane("a", { x: 103, y: 197, w: 251, h: 79 })]);
    api.setGrid({ enabled: true, step: 20 });
    api.selectMany(["a"]);
    expect(api.alignToGrid()).toBe(1);
    const aligned = api.panes.value[0];
    expect([aligned.x, aligned.y, aligned.w, aligned.h]).toEqual([
      100, 200, 260, 80
    ]);
  });
});

describe("自由画布编辑域：云端剪贴板与模板版本", () => {
  it("复制时双写云端（本地照旧可用）", async () => {
    const { fetchCloudClipboard, saveCloudClipboard } =
      await import("../serverTemplates");
    const { api } = await setup();
    api.selectMany(["a"]);
    api.copy();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(saveCloudClipboard).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(saveCloudClipboard).mock.calls[0][0];
    expect(payload.design_w).toBe(1920);
    expect(payload.panes).toHaveLength(1);
    expect(fetchCloudClipboard).not.toHaveBeenCalled();
  });

  it("云端粘贴：空槽位给提示且不插窗格；有槽位走插入链路", async () => {
    const server = await import("../serverTemplates");
    const { api, pushes } = await setup([
      pane("a", { x: 100, y: 100, w: 200, h: 100 })
    ]);
    expect(await api.pasteFromCloud()).toBe(0);

    vi.mocked(server.fetchCloudClipboard).mockResolvedValue({
      pk: "c1",
      free_layout: {
        design_w: 1920,
        design_h: 1080,
        panes: [
          { pk: "x1", type: "text", x: 10, y: 20, w: 200, h: 80, text: "云端" }
        ]
      }
    });
    expect(await api.pasteFromCloud()).toBe(1);
    expect(api.panes.value).toHaveLength(2);
    expect(api.panes.value.at(-1)?.pk).not.toBe("x1");
    expect(pushes).toHaveLength(1);
  });

  it("模板版本：列表透传 + 回滚成功后刷新团队模板", async () => {
    const server = await import("../serverTemplates");
    const { api } = await setup();
    vi.mocked(server.fetchTemplateVersions).mockResolvedValue([
      { pk: "v2", version: 2, name: "两版" },
      { pk: "v1", version: 1, name: "一版" }
    ]);
    const rows = await api.templateVersions("t1");
    expect(rows.map(row => row.version)).toEqual([2, 1]);

    vi.mocked(server.rollbackTemplate).mockResolvedValue({
      pk: "t1",
      name: "一版",
      visibility: "shared"
    });
    expect(await api.rollbackTemplate("t1", 1)).toBe(true);
    expect(server.rollbackTemplate).toHaveBeenCalledWith("t1", 1);
    expect(server.fetchServerTemplates).toHaveBeenCalled();
  });
});
