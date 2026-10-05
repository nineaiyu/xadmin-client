<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { useConfirm } from "@/hooks/useConfirm";
import { SUCCESS_CODE } from "@/api/types";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { message } from "@/utils/message";
import {
  listDashboards,
  screenApi,
  type ScreenItem,
  type ScreenLayoutPane
} from "@/api/dataset/analysis";
import {
  datasetApi,
  listRows,
  type DashboardItem,
  type DatasetItem
} from "@/api/dataset/datasets";
import ScreenPane from "./components/ScreenPane.vue";
import PaneInspector from "./components/PaneInspector.vue";
import DesignerPalette from "./components/DesignerPalette.vue";
import { GRID_COLS, canPlace, clampBox, normalizePanes } from "./utils/layout";
import { usePaneHistory } from "./utils/history";
import { createPaneOps } from "./utils/paneOps";
import { useCanvasDrag } from "./utils/canvasDrag";
import { useScreenShortcuts } from "./utils/shortcuts";
import { createCanvasDropHandler, onPaletteDragStart } from "./utils/dnd";

defineOptions({ name: "DataScreenDesigner" });

/**
 * 大屏画布设计器（编排层：状态持有 + 各交互域组装）。
 *
 * 形态：左侧组件库（指标卡 / 图片 / 文本 / 时钟 / 仪表盘）→ 画布（12 列栅格，拖拽
 * 移动 + 右下角缩放）→ 右侧属性面板 → 顶部撤销重做/保存/预览。画布与投屏页共用
 * `ScreenPane`，所见即所得。
 *
 * 交互口径（实现分散在各 utils composable，此处只持状态与接线）：
 * - 拖拽/缩放（utils/canvasDrag）：先算「格数增量」再夹回栅格，落点与其他窗格
 *   重叠时**保持原位**（不弹错）；
 * - 组件库点击/拖入（utils/paneOps + utils/dnd）：新增窗格自动找首个空位
 *   （`findSlot`），画布排满给出可读提示；拖入落点可放则直接落格；
 * - 历史（utils/history）：增删改与拖拽手势各记一个撤销点（连续同类编辑合并），
 *   Ctrl/Cmd+Z 撤销、Ctrl/Cmd+Shift+Z 或 Ctrl/Cmd+Y 重做；
 * - 快捷键（utils/shortcuts）：方向键移动选中窗格（Shift+方向 = 缩放）、
 *   Ctrl/Cmd+D 复制、Delete 删除、Ctrl/Cmd+S 保存、Esc 取消选中（输入框聚焦时
 *   不劫持按键）；
 * - 保存前本地归一化（丢未声明键、按类型补默认值），服务端仍会再校验一次（双保险）；
 * - `layout` 清空即回到轮播模式（存量形态与既有 E2E 不受影响）；
 * - 有未保存改动时离开设计器/关闭页面均给确认拦截。
 */
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const confirm = useConfirm();

const screen = ref<ScreenItem | null>(null);
const dashboards = ref<DashboardItem[]>([]);
const datasets = ref<DatasetItem[]>([]);
const panes = ref<ScreenLayoutPane[]>([]);
const selectedPk = ref("");
const preview = ref(false);
const saving = ref(false);
const dirty = ref(false);
const clock = ref("");
const loading = ref(true);

const canvasRef = ref<HTMLElement>();

/** 栅格度量：与样式里的 gap / 行高保持一致（拖拽换算依赖它，改样式必须同步改这里） */
const GAP_X = 12;
const GAP_Y = 12;
const ROW_HEIGHT = 40;
/** 画布内边距（content box 从 padding 之后开始，drop 落点换算要扣掉） */
const CANVAS_PADDING = 16;

const selected = computed(() =>
  panes.value.find(pane => pane.pk === selectedPk.value)
);
const dashboardName = (pk?: string) =>
  dashboards.value.find(item => item.pk === pk)?.name ?? "";
const cardsOf = (pane: ScreenLayoutPane) =>
  dashboards.value.find(item => item.pk === pane.dashboard)?.layout ?? [];

const metrics = () => {
  const width = canvasRef.value?.clientWidth ?? 0;
  const content = Math.max(width - CANVAS_PADDING * 2, 0);
  const stepX = content > 0 ? (content + GAP_X) / GRID_COLS : 1;
  return { stepX, stepY: ROW_HEIGHT + GAP_Y };
};

const markDirty = () => {
  dirty.value = true;
};

const { pushHistory, canUndo, canRedo, undo, redo, resetCoalesce } =
  usePaneHistory({ panes, selectedPk, markDirty });

const { addPane, duplicateSelected, removePane, updatePane } = createPaneOps({
  panes,
  selectedPk,
  pushHistory,
  t
});

const { startTracking } = useCanvasDrag({
  panes,
  selectedPk,
  markDirty,
  metrics,
  pushHistory
});

/** 方向键移动/缩放选中窗格：与拖拽同口径（夹回栅格 + 重叠驳回） */
function nudge(
  pane: ScreenLayoutPane,
  key: string,
  dx: number,
  dy: number,
  shift: boolean
) {
  const index = panes.value.findIndex(item => item.pk === pane.pk);
  if (index < 0) return false;
  const next = shift
    ? clampBox({ ...pane, w: pane.w + dx, h: pane.h + dy })
    : clampBox({ ...pane, x: pane.x + dx, y: pane.y + dy });
  if (!canPlace(panes.value, next, index)) return false;
  pushHistory(`nudge-${pane.pk}-${key}-${shift ? "size" : "move"}`);
  panes.value[index] = { ...pane, ...next };
  return true;
}

useScreenShortcuts({
  preview,
  save,
  undo,
  redo,
  duplicateSelected,
  removePane,
  selected,
  selectedPk,
  nudge
});

const onCanvasDrop = createCanvasDropHandler({
  canvasRef,
  metrics,
  grid: {
    gapX: GAP_X,
    gapY: GAP_Y,
    rowHeight: ROW_HEIGHT,
    padding: CANVAS_PADDING
  },
  addPane
});

let clockTimer: number | undefined;

onMounted(async () => {
  const pk = String(route.query.pk ?? "");
  if (!pk) {
    message(t("dataScreen.pickScreenFirst"), { type: "warning" });
    router.replace("/analysis/screen/index");
    return;
  }
  const res = await screenApi.retrieve(pk);
  if (res.code !== SUCCESS_CODE || !res.data) {
    message(t("dataScreen.loadFailed"), { type: "warning" });
    router.replace("/analysis/screen/index");
    return;
  }
  screen.value = res.data as ScreenItem;
  panes.value = [...(screen.value.layout ?? [])];
  [dashboards.value, datasets.value] = await Promise.all([
    listDashboards(),
    loadDatasets()
  ]);
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

const loadDatasets = async () => {
  const res = (await fetchAllRows(datasetApi.list)) as never;
  return listRows<DatasetItem>(res);
};

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
  if (!screen.value || saving.value) return;
  saving.value = true;
  try {
    const res = await screenApi
      .partialUpdate(screen.value.pk, { layout: normalizePanes(panes.value) })
      .catch(error => ({
        code: -1,
        detail: String((error as { detail?: string })?.detail ?? error)
      }));
    if (res.code === SUCCESS_CODE) {
      dirty.value = false;
      resetCoalesce();
      message(t("dataScreen.layoutSaved"), { type: "success" });
      return;
    }
    if (res.detail) message(String(res.detail), { type: "warning" });
  } finally {
    saving.value = false;
  }
}

async function clearCanvas() {
  if (panes.value.length === 0) return;
  if (
    !(await confirm(t("dataScreen.clearLayoutConfirm"), {
      title: t("dataScreen.clearLayout")
    }))
  ) {
    return;
  }
  pushHistory();
  panes.value = [];
  selectedPk.value = "";
}

const back = () => {
  router.push("/analysis/screen/index");
};
</script>

<template>
  <div class="designer-root fixed inset-0 flex flex-col text-white">
    <header class="designer-header">
      <span class="designer-title">
        {{ t("dataScreen.designer") }}
        <span class="designer-subtitle">· {{ screen?.name }}</span>
      </span>
      <el-tag v-if="dirty" size="small" type="warning" effect="dark">
        {{ t("dataScreen.unsaved") }}
      </el-tag>
      <div class="flex-1" />
      <el-button
        size="small"
        data-testid="designer-undo"
        :disabled="!canUndo || preview"
        :title="t('dataScreen.undoHint')"
        @click="undo"
      >
        {{ t("dataScreen.undo") }}
      </el-button>
      <el-button
        size="small"
        data-testid="designer-redo"
        :disabled="!canRedo || preview"
        :title="t('dataScreen.redoHint')"
        @click="redo"
      >
        {{ t("dataScreen.redo") }}
      </el-button>
      <el-button
        size="small"
        data-testid="designer-duplicate"
        :disabled="!selected || preview"
        :title="t('dataScreen.duplicateHint')"
        @click="duplicateSelected"
      >
        {{ t("dataScreen.duplicate") }}
      </el-button>
      <el-button
        size="small"
        data-testid="designer-refresh"
        @click="refreshData"
      >
        {{ t("dataScreen.refreshData") }}
      </el-button>
      <el-button
        size="small"
        data-testid="designer-preview"
        @click="preview = !preview"
      >
        {{ preview ? t("dataScreen.editMode") : t("dataScreen.preview") }}
      </el-button>
      <el-button
        size="small"
        data-testid="designer-clear"
        :disabled="panes.length === 0"
        @click="clearCanvas"
      >
        {{ t("dataScreen.clearLayout") }}
      </el-button>
      <el-button size="small" @click="back">
        {{ t("dataScreen.backToList") }}
      </el-button>
      <el-button
        type="primary"
        size="small"
        :loading="saving"
        data-testid="designer-save"
        @click="save"
      >
        {{ t("dataScreen.save") }}
      </el-button>
    </header>

    <div class="designer-body">
      <DesignerPalette
        v-if="!preview"
        :dashboards="dashboards"
        @add="addPane"
        @drag-start="onPaletteDragStart"
      />

      <main
        ref="canvasRef"
        class="designer-canvas"
        :class="{ 'is-preview': preview }"
        data-testid="designer-canvas"
        @pointerdown.self="selectedPk = ''"
        @dragover.prevent
        @drop.prevent="onCanvasDrop"
      >
        <span v-if="!loading && panes.length === 0" class="designer-empty">
          {{ t("dataScreen.emptyCanvas") }}
        </span>
        <ScreenPane
          v-for="pane in panes"
          :key="pane.pk"
          :ref="setPaneRef(pane.pk)"
          :pane="pane"
          :cards="cardsOf(pane)"
          :clock="clock"
          :dashboard-name="dashboardName(pane.dashboard)"
          :editable="!preview"
          :selected="pane.pk === selectedPk"
          @select="selectedPk = $event"
          @remove="removePane"
          @drag-start="startTracking('move', $event.pk, $event.event)"
          @resize-start="startTracking('resize', $event.pk, $event.event)"
        />
      </main>

      <aside v-if="!preview" class="designer-inspector">
        <PaneInspector
          v-if="selected"
          :pane="selected"
          :dashboards="dashboards"
          :datasets="datasets"
          @update="updatePane"
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
  background: #070b14;
}

.designer-header {
  display: flex;
  flex: none;
  gap: 10px;
  align-items: center;
  padding: 12px 20px;
  background: rgb(255 255 255 / 3%);
  border-bottom: 1px solid rgb(255 255 255 / 8%);
}

.designer-title {
  font-size: 18px;
  font-weight: 600;
}

.designer-subtitle {
  font-size: var(--el-font-size-base);
  font-weight: 400;
  color: rgb(255 255 255 / 62%);
}

.designer-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.designer-inspector {
  flex: none;
  width: 260px;
  padding: 14px 12px;
  overflow: auto;
  background: rgb(255 255 255 / 3%);
  border-left: 1px solid rgb(255 255 255 / 8%);
}

.designer-canvas {
  position: relative;

  /* 栅格底板：与窗格定位口径一致（12 列 / 40px 行高 / 12px 间距） */
  display: grid;
  flex: 1;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-auto-rows: 40px;
  gap: 12px;
  align-content: start;
  padding: 16px;
  overflow: auto;
  background-image:
    linear-gradient(rgb(255 255 255 / 5%) 1px, transparent 0),
    linear-gradient(90deg, rgb(255 255 255 / 5%) 1px, transparent 0);
  background-size:
    100% 52px,
    calc(100% / 12) 100%;
}

.designer-canvas.is-preview {
  background-image: none;
}

.designer-empty {
  grid-column: 1 / -1;
  padding: 40px 0;
  color: rgb(255 255 255 / 45%);
  text-align: center;
}

.designer-hint {
  font-size: var(--el-font-size-extra-small);
  line-height: 1.6;
  color: rgb(255 255 255 / 55%);
}
</style>
