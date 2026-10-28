<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { hasAuth } from "@/router/utils";
import { choiceValue } from "@/utils/dict";
import { isSuccess } from "@/api/types";
import { message } from "@/utils/message";
import {
  listScreenVersions,
  type ScreenChoiceValue,
  type ScreenItem,
  type ScreenLayoutMode
} from "@/api/dataset/analysis";
import { VersionHistoryDialog } from "@/components/VersionHistoryDialog";
import type { VersionHistoryRow } from "@/components/VersionHistoryDialog";
import type { DashboardItem, DatasetItem } from "@/api/dataset/datasets";
import DesignerToolbar from "./components/DesignerToolbar.vue";
import FreeCanvasToolbar from "./components/FreeCanvasToolbar.vue";
import GridCanvasBoard from "./components/GridCanvasBoard.vue";
import FreeCanvasBoard from "./components/FreeCanvasBoard.vue";
import ScreenPane from "./components/ScreenPane.vue";
import PaneInspector from "./components/PaneInspector.vue";
import MultiSelectInspector from "./components/MultiSelectInspector.vue";
import DesignerPalette from "./components/DesignerPalette.vue";
import { useScreenPersistence } from "./utils/useScreenPersistence";
import { createScreenVersionActions } from "./utils/screenVersions";
import { useDesignerActions } from "./utils/useDesignerActions";
import { useDesignerBootstrap } from "./utils/useDesignerBootstrap";
import { usePaneHistory } from "./utils/history";
import {
  createGridEditor,
  type GridBoardHandle
} from "./utils/createGridEditor";
import { createFreeEditor } from "./utils/createFreeEditor";
import { useScreenShortcuts } from "./utils/shortcuts";
import { onPaletteDragStart } from "./utils/dnd";
import { useScreenTheme, type ScreenTheme } from "./utils/screenTheme";
import { useDesignerGuard } from "@/hooks/useDesignerGuard";

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
const router = useRouter();
const { t, locale } = useI18n();
const screen = ref<ScreenItem | null>(null);
const dashboards = ref<DashboardItem[]>([]);
const datasets = ref<DatasetItem[]>([]);
const mode = ref<ScreenLayoutMode>("grid");
const preview = ref(false);
const saving = ref(false);
const dirty = ref(false);
const clock = ref("");
const loading = ref(true);
const versionsVisible = ref(false);

async function loadVersions(): Promise<VersionHistoryRow[]> {
  if (!screen.value) return [];
  const res = await listScreenVersions(screen.value.pk);
  if (!isSuccess(res)) throw new Error(res.detail ?? "");
  return (res.data ?? []) as VersionHistoryRow[];
}

const versionMeta = (row: VersionHistoryRow) =>
  choiceValue(row.layout_mode as ScreenChoiceValue) === "free"
    ? t("dataScreen.modeFree")
    : t("dataScreen.modeGrid");

const gridBoardRef = ref<GridBoardHandle>(null);
const freeBoardRef = ref<InstanceType<typeof FreeCanvasBoard> | null>(null);

/** 只读态：非创建者记录后端会拒绝写入（1003），前端进入即置只读，
 *  属 UX 层守卫——写权威始终在后端，详情接口未返回 is_owner 时按可编辑放行 */
const readonly = computed(
  () => !hasAuth("partialUpdate:DataScreen") || screen.value?.is_owner === false
);
const locked = computed(() => preview.value || readonly.value);
const isFree = computed(() => mode.value === "free");

/** 编辑序号：markDirty 单调递增；保存发起时快照，成功回调只在序号未前进时清 dirty
 *  （防保存 RTT 内的新编辑被误判「已保存」，见 useScreenPersistence） */
let editSeq = 0;
const markDirty = () => {
  dirty.value = true;
  editSeq += 1;
};

/** 大屏主题（深色缺省 / 浅色 / 跟随站点）：编辑中即时预览，与投屏同一套解析 */
const themeRoot = ref<HTMLElement>();
const { screenDark } = useScreenTheme({ screen, root: themeRoot });

/** 主题是表单级属性（不是画布操作）：不进撤销栈，改动即时标脏 */
const setTheme = (patch: { theme?: ScreenTheme; theme_color?: string }) => {
  if (!screen.value || readonly.value) return;
  screen.value = { ...screen.value, ...patch };
  markDirty();
};
/** 工具条回显（服务端 labeled choice → 标量）与保存载荷共用 */
const themeValue = computed<ScreenTheme>(
  () => (choiceValue(screen.value?.theme) as ScreenTheme) || "dark"
);
const themeColorValue = computed(() => screen.value?.theme_color ?? "");

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
  design: freeDesign,
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

/** 保存 / 清空（实现见 utils/useScreenPersistence，行数门禁抽出） */
const { save, clearCanvas } = useScreenPersistence({
  t,
  screen,
  saving,
  dirty,
  readonly,
  preview,
  isFree,
  activePanes,
  gridPanes,
  freePanes,
  theme: () => ({
    theme: themeValue.value,
    theme_color: themeColorValue.value
  }),
  freePayload: panes => free.toPayload(panes),
  editSeq: () => editSeq,
  pushHistory: () => pushHistory(),
  resetCoalesce: () => {
    gridHistory.resetCoalesce();
    freeHistory.resetCoalesce();
  },
  clearSelection: () => {
    grid.clearSelection();
    free.clearSelection();
  }
});

const { rollbackTo } = createScreenVersionActions({
  t,
  screen,
  saving,
  readonly,
  preview
});

/* 模式分派动作（一行分派与「仅自由模式」口径收口在 useDesignerActions，行数门禁抽出） */
const {
  onPaletteAdd,
  updateSelected,
  duplicatePane,
  removeSelected,
  clearSelection,
  nudge,
  copy,
  paste,
  selectAll,
  zoomIn,
  zoomOut,
  zoomFit
} = useDesignerActions({ isFree, readonly, grid, free });

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
  copy,
  paste,
  selectAll,
  zoomIn,
  zoomOut,
  zoomFit
});

/** 模式切换：只改模式（坐标不互转），切回另一模式即见原布局；未保存过则标脏 */
function switchMode(next: ScreenLayoutMode) {
  if (next === mode.value) return;
  mode.value = next;
  grid.clearSelection();
  free.clearSelection();
  if (choiceValue(screen.value?.layout_mode) !== next) markDirty();
}

/* 装载时序（进场校验 / 载荷装载 / 引用数据 / 时钟起表，见 useDesignerBootstrap） */
useDesignerBootstrap({
  t,
  locale,
  screen,
  mode,
  loading,
  clock,
  dashboards,
  datasets,
  grid,
  free
});

/* ---------------- 未保存守卫（关闭刷新 / 路由离开，实现见 useDesignerGuard） ---------------- */
useDesignerGuard({ dirty, namespace: "dataScreen" });

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

/** 回滚成功：把服务端恢复的两份载荷重新装进编辑器（模式/选中一并重置） */
async function onRollback(version: number) {
  const updated = await rollbackTo(version);
  if (!updated) return;
  mode.value = choiceValue(updated.layout_mode) === "free" ? "free" : "grid";
  grid.load(updated.layout ?? []);
  free.load(updated.free_layout ?? {});
  grid.clearSelection();
  free.clearSelection();
  dirty.value = false;
  versionsVisible.value = false;
  message(t("dataScreen.versionRolledBack", { n: version }), {
    type: "success"
  });
  refreshData();
}

const back = () => {
  router.push("/analysis/screen/index");
};
</script>

<template>
  <div
    ref="themeRoot"
    class="designer-root fixed inset-0 flex flex-col"
    :class="{
      'screen-root--light': !screenDark,
      'text-white': screenDark,
      'text-(--screen-fg)': !screenDark
    }"
    :data-screen-theme="screenDark ? 'dark' : 'light'"
  >
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
      :theme="themeValue"
      :theme-color="themeColorValue"
      @mode="switchMode"
      @theme="setTheme"
      @undo="undo"
      @redo="redo"
      @duplicate="duplicatePane"
      @refresh="refreshData"
      @preview="preview = !preview"
      @clear="clearCanvas"
      @versions="versionsVisible = true"
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
        free.saveCurrentToServer($event.name, $event.visibility, $event.group)
      "
      @paste-cloud="free.pasteFromCloud"
      @clear-cloud="free.clearCloud"
      @rollback-template="free.rollbackTemplate($event.id, $event.version)"
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

    <VersionHistoryDialog
      v-model="versionsVisible"
      :title="t('dataScreen.versionHistory')"
      :load="loadVersions"
      :meta-label="t('dataScreen.versionMode')"
      :meta-text="versionMeta"
      @rollback="onRollback"
    />
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
