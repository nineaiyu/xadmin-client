import { computed, ref, type Ref } from "vue";
import { message } from "@/utils/message";
import { mergeUnique } from "@/utils/unique";
import type {
  ScreenFreeLayout,
  ScreenLayoutPane,
  ScreenPaneType
} from "@/api/dataset/analysis";
import type { DashboardItem, DatasetItem } from "@/api/dataset/datasets";
import {
  FREE_DESIGN_DEFAULTS,
  buildFreeLayout,
  clampFreeBox,
  readFreeLayout,
  type FreeDesign
} from "./freeLayout";
import { createFreePaneOps, type FreeLayerAction } from "./freePaneOps";
import {
  alignBoxes,
  distributeBoxes,
  snapBoxesToGrid,
  type AlignMode,
  type DistributeAxis
} from "./freeAlign";
import { clampGroupDelta } from "./freeSelect";
import { batchCoalesceKey, batchUpdateTargets } from "./freeBatchUpdate";
import {
  createClipboard,
  readClipboard,
  writeClipboard
} from "./freeClipboard";
import { createPaneInserter } from "./freeInserter";
import { fetchCloudClipboard, saveCloudClipboard } from "./serverTemplates";
import { createFreeTemplates } from "./createFreeTemplates";
import { nudgeCoalesceKey } from "./history";
import type { PaneBox } from "./layout";
import {
  FREE_GRID_DEFAULT_STEP,
  FREE_GRID_STEPS,
  type FreeGridSnap
} from "./freeSnap";
import { readGridSnap, writeGridSnap } from "./gridPrefs";
import { useCanvasZoom } from "./useCanvasZoom";
import type { TranslateFn } from "./types";

/** 元素级网格吸附的本地记忆键（开关 + 步长；与本模块其它偏好同一命名空间） */
export type FreeBoxMap = Record<string, PaneBox>;

/**
 * 自由画布编辑域（设计器组装层与画布 / 面板之间的唯一接口）。
 *
 * 覆盖：载荷装载与组装、窗格增删改、**选择模型**（`selection` 为单一真相，单选目标
 * 由它派生）、**显示缩放**（`useCanvasZoom`，只作用于渲染与指针换算）、手势落数据
 * （组拖动整组一个撤销点）、对齐与分布、层级（含多选整组）、剪贴板与模板
 * （插入链路见 `freeInserter`，模板域见 `createFreeTemplates`）。
 * UI（弹窗 / 名称输入）不在此处：这里只吐数据、结果与提示。
 */
export function createFreeEditor(deps: {
  t: TranslateFn;
  markDirty: () => void;
  pushHistory: (key?: string) => void;
  dashboards: Ref<DashboardItem[]>;
  datasets: Ref<DatasetItem[]>;
  /** 画布视口元素（画布板挂载后交出，缩放换算与锚点补偿用） */
  viewport: Ref<HTMLElement | undefined>;
}) {
  const design = ref<FreeDesign>({ ...FREE_DESIGN_DEFAULTS });
  const panes = ref<ScreenLayoutPane[]>([]);
  const selection = ref<string[]>([]);
  const hasClipboard = ref(Boolean(readClipboard()));
  const gridSnap = ref<FreeGridSnap>(readGridSnap());
  /** 本手势是否已记撤销点（组拖动首次移动时记，停手不重复记） */
  let gestureTouched = false;

  /** 网格吸附开关 / 步长：非法步长回落缺省，选择记忆在本地（换会话仍然生效） */
  function setGrid(next: FreeGridSnap) {
    gridSnap.value = {
      enabled: Boolean(next.enabled),
      step: FREE_GRID_STEPS.includes(next.step)
        ? next.step
        : FREE_GRID_DEFAULT_STEP
    };
    writeGridSnap(gridSnap.value);
  }

  const zoomApi = useCanvasZoom({ design, viewport: deps.viewport });

  const selectedPk = computed(
    () => selection.value[selection.value.length - 1] ?? ""
  );
  /** 主选窗格（快捷键判定用：多选时方向键整组移动，仍以主选为判定目标） */
  const primaryPane = computed(() =>
    panes.value.find(pane => pane.pk === selectedPk.value)
  );
  /** 单选目标（多选时为空：属性面板切换为多选面板） */
  const singleSelected = computed(() =>
    selection.value.length === 1 ? primaryPane.value : undefined
  );
  const selectionCount = computed(() => selection.value.length);

  /* ---------------- 载荷装载 / 组装 ---------------- */

  function load(raw?: Partial<ScreenFreeLayout> | null) {
    const read = readFreeLayout(raw);
    design.value = read.design;
    panes.value = read.panes;
    selection.value = [];
  }

  const toPayload = () => buildFreeLayout(panes.value, design.value);

  /* ---------------- 选择 ---------------- */

  function selectPk(pk: string, additive = false) {
    if (!pk) {
      selection.value = [];
      return;
    }
    if (!additive) {
      selection.value = [pk];
      return;
    }
    selection.value = selection.value.includes(pk)
      ? selection.value.filter(item => item !== pk)
      : [...selection.value, pk];
  }

  /** 框选结果：追加则并入现有选区，否则整体替换 */
  function selectMany(pks: string[], additive = false) {
    if (!additive) {
      selection.value = [...pks];
      return;
    }
    selection.value = mergeUnique(selection.value, pks);
  }

  const selectAll = () => {
    selection.value = panes.value.map(pane => pane.pk);
  };
  const clearSelection = () => {
    selection.value = [];
  };

  /* ---------------- 插入链路 / 模板域（可复用的两块） ---------------- */

  const inserter = createPaneInserter({
    t: deps.t,
    panes,
    selection,
    design,
    dashboards: deps.dashboards,
    datasets: deps.datasets,
    pushHistory: deps.pushHistory,
    markDirty: deps.markDirty
  });
  const templateApi = createFreeTemplates({
    t: deps.t,
    design,
    panes,
    selection,
    inserter
  });

  /* ---------------- 窗格操作（单格语义归 freePaneOps） ---------------- */

  const ops = createFreePaneOps({
    panes,
    design,
    select: pk => selectPk(pk),
    current: () => (selection.value.length === 1 ? selection.value[0] : ""),
    pushHistory: deps.pushHistory,
    t: deps.t
  });

  const addPane = (type: ScreenPaneType, dashboard?: string) =>
    ops.addPane(type, dashboard);

  /** 删除单个窗格：同步把它从选区移出（选中不归 paneOps 管） */
  function removePk(pk: string) {
    ops.removePane(pk);
    selection.value = selection.value.filter(item => item !== pk);
  }

  function removeSelected(): number {
    const pks = [...selection.value];
    if (pks.length === 0) return 0;
    if (pks.length === 1) {
      removePk(pks[0]);
      return 1;
    }
    deps.pushHistory();
    panes.value = panes.value.filter(pane => !pks.includes(pane.pk));
    selection.value = [];
    return pks.length;
  }

  const updatePane = (patch: Partial<ScreenLayoutPane>) =>
    ops.updatePane(patch);

  /**
   * 批量属性编辑（多选）：字段 → 适用窗格类型（与服务端 `_normalize_pane_body` 同口径，
   * 避免把 `text_format` 塞给时钟、把 `size` 塞给图片这类「注定被服务端丢掉」的写入）。
   * `rotate` / `animation` 适用于全部类型。
   */
  /**
   * 批量改属性（多选）：**统一值语义**——同一个值写给选区里「该字段适用」的窗格，
   * 一次操作一个撤销点；不适用的跳过、值没变化的跳过（规则与适用性在 freeBatchUpdate）。
   */
  function updateMany(patch: Partial<ScreenLayoutPane>): number {
    const targets = batchUpdateTargets(panes.value, selection.value, patch);
    const keys = Object.keys(targets);
    if (keys.length === 0) return 0;
    deps.pushHistory(
      batchCoalesceKey(
        Object.keys(patch).sort(),
        selection.value.filter(pk => keys.includes(pk))
      )
    );
    for (const pk of keys) {
      const index = panes.value.findIndex(pane => pane.pk === pk);
      if (index >= 0) panes.value[index] = targets[pk];
    }
    deps.markDirty();
    return keys.length;
  }

  /* ---------------- 手势：停手落数据（整组一个撤销点） ---------------- */

  function ensureHistory(key: string) {
    if (gestureTouched) return;
    gestureTouched = true;
    deps.pushHistory(key);
  }

  function writeBoxes(map: FreeBoxMap) {
    for (const [pk, box] of Object.entries(map)) {
      const index = panes.value.findIndex(pane => pane.pk === pk);
      if (index >= 0) panes.value[index] = { ...panes.value[index], ...box };
    }
  }

  /** 组拖动：整组跟随锚点（几何夹取在画布板完成），写数据但不单独记撤销点 */
  function onGroupMove(payload: { pk: string; boxes: FreeBoxMap }) {
    ensureHistory(`drag-${payload.pk}-group`);
    writeBoxes(payload.boxes);
    deps.markDirty();
  }

  /** 手势停手：位移为 0 不记撤销点；组拖动已有撤销点时不再补记 */
  function onBoxStop(payload: {
    pk: string;
    box: PaneBox;
    gesture: "move" | "resize";
  }) {
    const index = panes.value.findIndex(pane => pane.pk === payload.pk);
    if (index >= 0) {
      const current = panes.value[index];
      const box = clampFreeBox(payload.box, design.value);
      if (
        box.x !== current.x ||
        box.y !== current.y ||
        box.w !== current.w ||
        box.h !== current.h
      ) {
        ensureHistory(`drag-${payload.pk}-${payload.gesture}`);
        panes.value[index] = { ...current, ...box };
      }
    }
    gestureTouched = false;
  }

  const onDrop = (payload: {
    type: ScreenPaneType;
    dashboard?: string;
    box: PaneBox;
  }) => ops.addPane(payload.type, payload.dashboard, payload.box);

  /** 键盘微调：整组同口径位移（组统一夹取，已在边界不记撤销点） */
  function nudge(dx: number, dy: number, shift: boolean): boolean {
    const pks = selection.value;
    if (pks.length === 0) return false;
    const step = shift ? 10 : 1;
    const delta = clampGroupDelta(
      panes.value,
      pks,
      dx * step,
      dy * step,
      design.value
    );
    if (delta.dx === 0 && delta.dy === 0) return false;
    deps.pushHistory(nudgeCoalesceKey(pks.join(","), false));
    for (const pk of pks) {
      const index = panes.value.findIndex(pane => pane.pk === pk);
      if (index < 0) continue;
      const pane = panes.value[index];
      panes.value[index] = {
        ...pane,
        x: pane.x + delta.dx,
        y: pane.y + delta.dy
      };
    }
    return true;
  }

  /* ---------------- 对齐 / 分布 / 层级 ---------------- */

  /** 批量改坐标：无实际变化时不记撤销点（连续点同一个对齐按钮不会堆空历史） */
  function applyBoxes(map: FreeBoxMap, key: string): number {
    const changed = Object.entries(map).filter(([pk, box]) => {
      const pane = panes.value.find(item => item.pk === pk);
      if (!pane) return false;
      return (
        pane.x !== box.x ||
        pane.y !== box.y ||
        pane.w !== box.w ||
        pane.h !== box.h
      );
    });
    if (changed.length === 0) return 0;
    deps.pushHistory(key);
    writeBoxes(Object.fromEntries(changed));
    return changed.length;
  }

  const align = (mode: AlignMode): number =>
    applyBoxes(
      alignBoxes(panes.value, selection.value, mode, design.value),
      `align-${mode}-${selection.value.join(",")}`
    );

  const distribute = (axis: DistributeAxis): number =>
    applyBoxes(
      distributeBoxes(panes.value, selection.value, axis, design.value),
      `distribute-${axis}-${selection.value.join(",")}`
    );

  /** 批量对齐网格：坐标与尺寸都落到当前步长倍数（已在网格上 = 不产生变更） */
  const alignToGrid = (): number =>
    applyBoxes(
      snapBoxesToGrid(
        panes.value,
        selection.value,
        design.value,
        gridSnap.value.step
      ),
      `grid-${selection.value.join(",")}`
    );

  /** 层级：单选走 freePaneOps；多选按选区整体置顶 / 置底 / 上移 / 下移一位 */
  function moveLayer(action: FreeLayerAction) {
    const pks = selection.value;
    if (pks.length === 0) return;
    if (pks.length === 1) {
      ops.moveLayer(pks[0], action);
      return;
    }
    const list = [...panes.value];
    const isChosen = (pane: ScreenLayoutPane) => pks.includes(pane.pk);
    const unchanged = (next: ScreenLayoutPane[]) =>
      next.every((pane, index) => pane.pk === list[index].pk);
    if (action === "top" || action === "bottom") {
      const chosen = list.filter(isChosen);
      const rest = list.filter(pane => !isChosen(pane));
      const next =
        action === "top" ? [...rest, ...chosen] : [...chosen, ...rest];
      if (unchanged(next)) return;
      deps.pushHistory();
      panes.value = next;
      return;
    }
    const next = [...list];
    const dir = action === "up" ? 1 : -1;
    const order =
      action === "up" ? [...next.keys()].reverse() : [...next.keys()];
    for (const index of order) {
      if (!isChosen(next[index])) continue;
      const target = index + dir;
      if (target < 0 || target >= next.length) continue;
      if (isChosen(next[target])) continue;
      [next[index], next[target]] = [next[target], next[index]];
    }
    if (unchanged(next)) return;
    deps.pushHistory();
    panes.value = next;
  }

  /* ---------------- 复制 / 粘贴（插入链路） ---------------- */

  /** 就地复制（含多选整组）：保持组内相对位置，整体层叠偏移 */
  const duplicate = (): number =>
    selection.value.length === 0
      ? 0
      : inserter.insert(
          panes.value.filter(pane => selection.value.includes(pane.pk))
        );

  function copy(): number {
    const payload = createClipboard(panes.value, selection.value, design.value);
    if (!payload) return 0;
    if (!writeClipboard(payload)) {
      message(deps.t("dataScreen.clipboardBlocked"), { type: "warning" });
    }
    hasClipboard.value = true;
    // 双写云端（ADR-090 D4）：失败只警告不阻断——本地剪贴板仍然可用
    void saveCloudClipboard({
      design_w: payload.design.design_w,
      design_h: payload.design.design_h,
      panes: payload.panes
    }).then(ok => {
      if (!ok) {
        message(deps.t("dataScreen.clipboardCloudFailed"), { type: "warning" });
      }
    });
    message(deps.t("dataScreen.copyDone", { n: payload.panes.length }), {
      type: "success"
    });
    return payload.panes.length;
  }

  function paste(): number {
    const payload = readClipboard();
    if (!payload) return 0;
    return inserter.insert(payload.panes);
  }

  /** 从云端粘贴（跨设备）：读服务端槽位 → 走插入链路；空槽位给可读提示 */
  async function pasteFromCloud(): Promise<number> {
    const slot = await fetchCloudClipboard();
    const payload = readFreeLayout(slot?.free_layout ?? null);
    if (payload.panes.length === 0) {
      message(deps.t("dataScreen.clipboardCloudEmpty"), { type: "warning" });
      return 0;
    }
    return inserter.insert(payload.panes);
  }

  return {
    design,
    panes,
    selection,
    selectionCount,
    selectedPk,
    primaryPane,
    singleSelected,
    hasClipboard,
    gridSnap,
    setGrid,
    ...zoomApi,
    load,
    toPayload,
    selectPk,
    selectMany,
    selectAll,
    clearSelection,
    addPane,
    removePk,
    removeSelected,
    updatePane,
    updateMany,
    onGroupMove,
    onBoxStop,
    onDrop,
    nudge,
    align,
    distribute,
    alignToGrid,
    moveLayer,
    duplicate,
    copy,
    paste,
    pasteFromCloud,
    templates: templateApi.templates,
    serverTemplates: templateApi.serverTemplates,
    refreshTemplates: templateApi.refresh,
    refreshServerTemplates: templateApi.refreshServer,
    saveCurrentAsTemplate: templateApi.saveCurrent,
    saveCurrentToServer: templateApi.saveToServer,
    applyTemplate: templateApi.apply,
    renameSavedTemplate: templateApi.rename,
    renameServerTemplate: templateApi.renameServer,
    removeSavedTemplate: templateApi.remove,
    removeServerTemplate: templateApi.removeServer,
    importTemplateJson: templateApi.importJson,
    exportSavedTemplate: templateApi.exportJson,
    templateVersions: templateApi.versions,
    rollbackTemplate: templateApi.rollback
  };
}

export type FreeEditorApi = ReturnType<typeof createFreeEditor>;

/** 模板应用方式（工具条与组合层的公共契约） */
export type { TemplateApplyMode } from "./createFreeTemplates";
