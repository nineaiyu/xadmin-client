<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { useConfirm } from "@/hooks/useConfirm";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { choiceValue } from "@/utils/dict";
import {
  screenApi,
  type ScreenItem,
  type ScreenLayoutMode,
  type ScreenLayoutPane,
  type ScreenPaneType
} from "@/api/dataset/analysis";
import type { DashboardItem, DatasetItem } from "@/api/dataset/datasets";
import DesignerToolbar from "./components/DesignerToolbar.vue";
import FreeCanvasToolbar from "./components/FreeCanvasToolbar.vue";
import GridCanvasBoard from "./components/GridCanvasBoard.vue";
import FreeCanvasBoard from "./components/FreeCanvasBoard.vue";
import ScreenPane from "./components/ScreenPane.vue";
import PaneInspector from "./components/PaneInspector.vue";
import MultiSelectInspector from "./components/MultiSelectInspector.vue";
import DesignerPalette from "./components/DesignerPalette.vue";
import { normalizePanes } from "./utils/layout";
import { usePaneHistory } from "./utils/history";
import {
  createGridEditor,
  type GridBoardHandle
} from "./utils/createGridEditor";
import { createFreeEditor } from "./utils/createFreeEditor";
import { useScreenShortcuts } from "./utils/shortcuts";
import { onPaletteDragStart } from "./utils/dnd";
import { loadScreenReferenceData } from "./utils/referenceData";
import { normalizeError } from "@/utils/apiError";

defineOptions({ name: "DataScreenDesigner" });

/**
 * 大屏画布设计器（编排层：模式 / 选中 / 撤销栈 / 保存 / 预览）。
 *
 * 两种画布模式各有**独立的编辑域工厂**，本层只做模式分派与公共时序：
 * - 栅格（缺省）：`createGridEditor`（12 列栅格、步进拖拽、重叠驳回、单选）；
 * - 自由：`createFreeEditor`（像素坐标、`ReResize` 手势、组拖动、对齐分布、
 *   剪贴板、模板、**显示缩放**；多选）。
 *
 * 交给画布板与面板的只有「数据 + 事件」，几何与批量语义都在工厂与纯函数里；
 * 模式切换只写 `layout_mode` 语义（坐标不互转，另一模式载荷原样保留）。
 * 只读态（非创建者记录）：编辑入口整体隐藏/禁用（写权威在后端，此处为 UX 守卫）。
 * 保存前各载荷本地归一化（丢未声明键、补默认值、夹回栅格/画幅），服务端再校验一次。
 */
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const confirm = useConfirm();

const screen = ref<ScreenItem | null>(null);
const dashboards = ref<DashboardItem[]>([]);
const datasets = ref<DatasetItem[]>([]);
const mode = ref<ScreenLayoutMode>("grid");
const preview = ref(false);
const saving = ref(false);
const dirty = ref(false);
const clock = ref("");
const loading = ref(true);

const gridBoardRef = ref<GridBoardHandle>(null);
const freeBoardRef = ref<InstanceType<typeof FreeCanvasBoard> | null>(null);

/** 只读态：非创建者记录后端会拒绝写入（1003），前端进入即置只读，
 *  属 UX 层守卫——写权威始终在后端，详情接口未返回 is_owner 时按可编辑放行 */
const readonly = computed(() => screen.value?.is_owner === false);
const locked = computed(() => preview.value || readonly.value);
const isFree = computed(() => mode.value === "free");

const markDirty = () => {
  dirty.value = true;
};

/* 两模式各持一个撤销栈（模式切换不把另一份载荷混进历史）；导出面按当前模式分派 */
const grid = createGridEditor({
  t,
  markDirty,
  pushHistory: key => gridHistory.pushHistory(key),
  board: gridBoardRef
});
const {
  panes: gridPanes,
  selectedPk: gridSelectedPk,
  selected: gridSelected
} = grid;

const free = createFreeEditor({
  t,
  markDirty,
  pushHistory: key => freeHistory.pushHistory(key),
  dashboards,
  datasets,
  viewport: computed(() => freeBoardRef.value?.viewportEl)
});
const {
  design: freeDesign,
  panes: freePanes,
  selection: freeSelection,
  selectionCount: freeSelectionCount,
  singleSelected: freeSingleSelected,
  primaryPane: freePrimaryPane,
  templates: freeTemplates,
  serverTemplates: freeServerTemplates,
  gridSnap: freeGridSnap,
  hasClipboard: freeHasClipboard,
  zoom: freeZoom,
  autoFit: freeAutoFit
} = free;

const gridHistory = usePaneHistory({
  panes: gridPanes,
  selectedPk: gridSelectedPk,
  markDirty
});
const freeHistory = usePaneHistory({
  panes: freePanes,
  selection: freeSelection,
  markDirty
});

const history = computed(() => (isFree.value ? freeHistory : gridHistory));
const pushHistory = (key?: string) => history.value.pushHistory(key);
const canUndo = computed(() => history.value.canUndo.value);
const canRedo = computed(() => history.value.canRedo.value);
const undo = () => history.value.undo();
const redo = () => history.value.redo();

/** 当前模式的窗格清单（清空 / 提示按它工作） */
const activePanes = computed(() =>
  isFree.value ? freePanes.value : gridPanes.value
);
/** 属性面板目标：自由多选时切「多选面板」，其余按各模式单选目标 */
const inspectorPane = computed(() =>
  isFree.value ? freeSingleSelected.value : gridSelected.value
);
/** 多选面板的批量属性按选中的窗格算公共值与适用性（顺序 = 数据顺序） */
const freeSelectedPanes = computed(() =>
  freePanes.value.filter(pane => freeSelection.value.includes(pane.pk))
);

/** 组件库点击：按当前模式落到对应载荷（栅格找空位 / 自由层叠错开） */
const onPaletteAdd = (type: ScreenPaneType, dashboard?: string) =>
  isFree.value ? free.addPane(type, dashboard) : grid.addPane(type, dashboard);

/** 属性面板更新：按当前模式落到对应载荷（栅格重叠驳回 / 自由夹回画幅） */
const updateSelected = (patch: Partial<ScreenLayoutPane>) =>
  isFree.value ? free.updatePane(patch) : grid.updatePane(patch);

const duplicatePane = () =>
  isFree.value ? free.duplicate() : grid.duplicateSelected();
const removeSelected = () =>
  isFree.value ? free.removeSelected() : grid.removeSelected();
const clearSelection = () =>
  isFree.value ? free.clearSelection() : grid.clearSelection();

/** 方向键：栅格 = 移动（Shift 缩放），自由 = 整组移动（Shift 10px 步进） */
function nudge(pane: ScreenLayoutPane, dx: number, dy: number, shift: boolean) {
  if (readonly.value) return false;
  return isFree.value
    ? free.nudge(dx, dy, shift)
    : grid.nudge(pane, dx, dy, shift);
}

useScreenShortcuts({
  locked,
  save,
  undo,
  redo,
  duplicateSelected: duplicatePane,
  removeSelected,
  clearSelection,
  selected: computed(() =>
    isFree.value ? freePrimaryPane.value : gridSelected.value
  ),
  nudge,
  // 三键只在自由模式生效：这里按模式判定而非装配期取函数（模式可中途切换）
  copy: () => {
    if (isFree.value) free.copy();
  },
  paste: () => {
    if (isFree.value) free.paste();
  },
  selectAll: () => {
    if (isFree.value) free.selectAll();
  },
  // zoom 键盘档位同样只在自由模式生效（栅格画布是响应式布局，无固定画幅）
  zoomIn: () => {
    if (isFree.value) free.zoomIn();
  },
  zoomOut: () => {
    if (isFree.value) free.zoomOut();
  },
  zoomFit: () => {
    if (isFree.value) free.fitToView();
  }
});

/** 模式切换：只改模式（坐标不互转），切回另一模式即见原布局；未保存过则标脏 */
function switchMode(next: ScreenLayoutMode) {
  if (next === mode.value) return;
  mode.value = next;
  grid.clearSelection();
  free.clearSelection();
  if (choiceValue(screen.value?.layout_mode) !== next) markDirty();
}

let clockTimer: number | undefined;

onMounted(async () => {
  const pk = String(route.query.pk ?? "");
  if (!pk) {
    message(t("dataScreen.pickScreenFirst"), { type: "warning" });
    router.replace("/analysis/screen/index");
    return;
  }
  const res = await screenApi.retrieve(pk).catch(() => null);
  if (!res || res.code !== SUCCESS_CODE || !res.data) {
    message(t("dataScreen.loadFailed"), { type: "warning" });
    router.replace("/analysis/screen/index");
    return;
  }
  screen.value = res.data as ScreenItem;
  // 模式与两份载荷各自装载：切回另一模式即见原布局（服务端已归一化，前端只读）
  mode.value =
    choiceValue(screen.value.layout_mode) === "free" ? "free" : "grid";
  grid.load(screen.value.layout);
  free.load(screen.value.free_layout);
  free.refreshTemplates();
  // 团队模板按需拉取（失败静默降级为空：不挡住本地模板与画布编辑）
  void free.refreshServerTemplates();
  // 引用数据失败不阻塞设计器主链路：显式提示并按空清单降级（此前未捕获——异常
  // 逃逸且 loading 永久悬挂，画布空白且用户无感知）
  const reference = await loadScreenReferenceData();
  if (!reference.dashboards) {
    message(t("dataScreen.dashboardsLoadFailed"), { type: "warning" });
  }
  if (!reference.datasets) {
    message(t("dataScreen.datasetsLoadFailed"), { type: "warning" });
  }
  dashboards.value = reference.dashboards ?? [];
  datasets.value = reference.datasets ?? [];
  loading.value = false;
  clock.value = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  clockTimer = window.setInterval(() => {
    clock.value = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  }, 1000);
  window.addEventListener("beforeunload", onBeforeUnload);
});

onBeforeUnmount(() => {
  window.clearInterval(clockTimer);
  window.removeEventListener("beforeunload", onBeforeUnload);
});

/* ---------------- 未保存守卫 ---------------- */
const onBeforeUnload = (event: BeforeUnloadEvent) => {
  if (!dirty.value) return;
  event.preventDefault();
  event.returnValue = "";
};

onBeforeRouteLeave(async () => {
  if (!dirty.value) return true;
  return confirm(t("dataScreen.leaveConfirm"), {
    title: t("dataScreen.unsaved"),
    confirmButtonText: t("dataScreen.leave"),
    cancelButtonText: t("dataScreen.stay")
  });
});

/* ---------------- 保存 / 清空 / 预览 ---------------- */
const paneRefs = ref<Record<string, InstanceType<typeof ScreenPane> | null>>(
  {}
);
const setPaneRef = (pk: string) => (el: unknown) => {
  paneRefs.value[pk] = el as InstanceType<typeof ScreenPane> | null;
};
const refreshData = () => {
  Object.values(paneRefs.value).forEach(handle => handle?.refresh?.());
};

async function save() {
  if (!screen.value || saving.value || readonly.value) return;
  saving.value = true;
  try {
    // 只写当前模式的载荷 + layout_mode（另一模式载荷原样保留；服务端校验对应关系）
    const payload = isFree.value
      ? { layout_mode: "free" as const, free_layout: free.toPayload() }
      : {
          layout_mode: "grid" as const,
          layout: normalizePanes(gridPanes.value)
        };
    const res = await screenApi
      .partialUpdate(screen.value.pk, payload)
      .catch(normalizeError);
    if (res.code === SUCCESS_CODE) {
      dirty.value = false;
      gridHistory.resetCoalesce();
      freeHistory.resetCoalesce();
      message(t("dataScreen.layoutSaved"), { type: "success" });
      return;
    }
    if (res.detail) message(String(res.detail), { type: "warning" });
  } finally {
    saving.value = false;
  }
}

/** 清空当前模式的载荷（另一模式的载荷保留，切回即可见） */
async function clearCanvas() {
  if (activePanes.value.length === 0 || readonly.value) return;
  const prompt = isFree.value
    ? t("dataScreen.freeClearConfirm")
    : t("dataScreen.clearLayoutConfirm");
  if (!(await confirm(prompt, { title: t("dataScreen.clearLayout") }))) {
    return;
  }
  pushHistory();
  if (isFree.value) freePanes.value = [];
  else gridPanes.value = [];
  grid.clearSelection();
  free.clearSelection();
}

const back = () => {
  router.push("/analysis/screen/index");
};
</script>

<template>
  <div class="designer-root fixed inset-0 flex flex-col text-white">
    <DesignerToolbar
      :screen-name="screen?.name"
      :dirty="dirty"
      :readonly="readonly"
      :preview="preview"
      :saving="saving"
      :mode="mode"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :has-selection="Boolean(inspectorPane) || freeSelectionCount > 0"
      :panes-empty="activePanes.length === 0"
      @mode="switchMode"
      @undo="undo"
      @redo="redo"
      @duplicate="duplicatePane"
      @refresh="refreshData"
      @preview="preview = !preview"
      @clear="clearCanvas"
      @back="back"
      @save="save"
    />

    <!-- 自由画布工具条（缩放 / 复制粘贴 / 模板）：只在自由模式且未锁定时出现 -->
    <FreeCanvasToolbar
      v-if="isFree && !locked"
      :zoom="freeZoom"
      :auto-fit="freeAutoFit"
      :can-copy="freeSelectionCount > 0"
      :can-paste="freeHasClipboard"
      :templates="freeTemplates"
      :server-templates="freeServerTemplates"
      :grid-snap="freeGridSnap"
      @zoom="free.setZoom"
      @fit="free.fitToView"
      @copy="free.copy"
      @paste="free.paste"
      @grid="free.setGrid"
      @save-template="free.saveCurrentAsTemplate"
      @save-server-template="
        free.saveCurrentToServer($event.name, $event.visibility)
      "
      @import-template="free.importTemplateJson($event.raw, $event.mode)"
      @apply-template="free.applyTemplate($event.id, $event.mode)"
      @rename-template="free.renameSavedTemplate($event.id, $event.name)"
      @rename-server-template="
        free.renameServerTemplate($event.id, $event.name)
      "
      @remove-template="free.removeSavedTemplate"
      @remove-server-template="free.removeServerTemplate"
      @export-template="free.exportSavedTemplate"
    />

    <div class="designer-body">
      <DesignerPalette
        v-if="!preview && !readonly"
        :dashboards="dashboards"
        @add="onPaletteAdd"
        @drag-start="onPaletteDragStart"
      />

      <FreeCanvasBoard
        v-if="isFree"
        ref="freeBoardRef"
        :panes="freePanes"
        :design="freeDesign"
        :selection="freeSelection"
        :editable="!locked"
        :zoom="freeZoom"
        :clock="clock"
        :dashboards="dashboards"
        :set-pane-ref="setPaneRef"
        :wheel-handler="free.onWheel"
        :grid-snap="freeGridSnap"
        :play-animation="preview"
        @select="free.selectPk($event.pk, $event.additive)"
        @select-many="free.selectMany($event.pks, $event.additive)"
        @remove="free.removePk"
        @group-move="free.onGroupMove"
        @box-stop="free.onBoxStop"
        @drop="free.onDrop"
      />

      <GridCanvasBoard
        v-else
        ref="gridBoardRef"
        :panes="gridPanes"
        :selected-pk="gridSelectedPk"
        :editable="!locked"
        :loading="loading"
        :preview="preview"
        :clock="clock"
        :dashboards="dashboards"
        :set-pane-ref="setPaneRef"
        @select="grid.selectPk($event)"
        @remove="grid.removePane"
        @drag-start="grid.startTracking('move', $event.pk, $event.event)"
        @resize-start="grid.startTracking('resize', $event.pk, $event.event)"
        @drop="grid.onDrop"
      />

      <aside v-if="!preview && !readonly" class="designer-inspector">
        <MultiSelectInspector
          v-if="isFree && freeSelectionCount > 1"
          :count="freeSelectionCount"
          :panes="freeSelectedPanes"
          @align="free.align"
          @distribute="free.distribute"
          @align-grid="free.alignToGrid"
          @layer="free.moveLayer"
          @duplicate="free.duplicate"
          @remove="free.removeSelected"
          @batch="free.updateMany"
        />
        <PaneInspector
          v-else-if="inspectorPane"
          :pane="inspectorPane"
          :layout="isFree ? 'free' : 'grid'"
          :design="freeDesign"
          :dashboards="dashboards"
          :datasets="datasets"
          @update="updateSelected"
          @layer="free.moveLayer"
        />
        <span v-else class="designer-hint">{{
          t("dataScreen.noSelection")
        }}</span>
      </aside>
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* 画布恒深色（与投屏页同底），保证设计所见即投屏所得 */
.designer-root {
  background: var(--screen-canvas);
}

.designer-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.designer-inspector {
  flex: none;
  width: 260px;
  padding: var(--space-3);
  overflow: auto;
  background: var(--screen-surface);
  border-left: 1px solid var(--screen-border);
}

.designer-hint {
  font-size: var(--el-font-size-extra-small);
  line-height: 1.6;
  color: var(--screen-fg-dim);
}
</style>
