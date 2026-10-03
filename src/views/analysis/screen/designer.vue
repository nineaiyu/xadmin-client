<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { ElMessageBox } from "element-plus";
import { SUCCESS_CODE } from "@/api/types";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { message } from "@/utils/message";
import {
  listDashboards,
  screenApi,
  type ScreenItem,
  type ScreenLayoutPane,
  type ScreenPaneType
} from "@/api/dataset/analysis";
import {
  datasetApi,
  listRows,
  type DashboardItem,
  type DatasetItem
} from "@/api/dataset/datasets";
import ScreenPane from "./components/ScreenPane.vue";
import PaneInspector from "./components/PaneInspector.vue";
import {
  GRID_COLS,
  MAX_PANES,
  PANE_DEFAULTS,
  canPlace,
  cellFromOffset,
  clampBox,
  findSlot,
  genPaneId,
  normalizePanes,
  type PaneBox
} from "./utils/layout";

defineOptions({ name: "DataScreenDesigner" });

/**
 * 大屏画布设计器。
 *
 * 形态：左侧组件库（指标卡 / 图片 / 文本 / 时钟 / 仪表盘）→ 画布（12 列栅格，拖拽
 * 移动 + 右下角缩放）→ 右侧属性面板 → 顶部撤销重做/保存/预览。画布与投屏页共用
 * `ScreenPane`，所见即所得。
 *
 * 交互口径：
 * - 拖拽/缩放都先算「格数增量」再夹回栅格，落点与其他窗格重叠时**保持原位**（不弹错）；
 * - 新增窗格自动找首个空位（`findSlot`），画布排满给出可读提示；组件库也支持
 *   拖拽落点放置（drop 在目标格且可放时直接落格，否则回落自动找位）；
 * - 保存前本地归一化（丢未声明键、按类型补默认值），服务端仍会再校验一次（双保险）；
 * - `layout` 清空即回到轮播模式（存量形态与既有 E2E 不受影响）；
 * - 历史：增删改与拖拽手势各记一个撤销点（连续同类编辑合并），Ctrl/Cmd+Z 撤销、
 *   Ctrl/Cmd+Shift+Z 或 Ctrl/Cmd+Y 重做；
 * - 快捷键：方向键移动选中窗格（Shift+方向 = 缩放）、Ctrl/Cmd+D 复制、Delete 删除、
 *   Ctrl/Cmd+S 保存、Esc 取消选中（输入框聚焦时不劫持按键）；
 * - 有未保存改动时离开设计器/关闭页面均给确认拦截。
 */
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

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
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("beforeunload", onBeforeUnload);
});

onBeforeUnmount(() => {
  window.clearInterval(clockTimer);
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("beforeunload", onBeforeUnload);
  stopPointerTracking();
});

const loadDatasets = async () => {
  const res = (await fetchAllRows(datasetApi.list)) as never;
  return listRows<DatasetItem>(res);
};

/* ---------------- 历史：撤销 / 重做 ---------------- */
const HISTORY_LIMIT = 50;
const past = ref<ScreenLayoutPane[][]>([]);
const future = ref<ScreenLayoutPane[][]>([]);
let coalesceKey = "";
let coalesceAt = 0;

const snapshot = () => panes.value.map(pane => ({ ...pane }));

/**
 * 记一个撤销点（在变更**前**调用）。`coalesceKey` 用于合并连续同类编辑
 * （如逐字输入文本 / 步进器连点）：800ms 内同 key 的变更并入上一个历史点。
 */
function pushHistory(key?: string) {
  const now = Date.now();
  if (key && key === coalesceKey && now - coalesceAt < 800) {
    coalesceAt = now;
    dirty.value = true;
    return;
  }
  coalesceKey = key ?? "";
  coalesceAt = now;
  past.value.push(snapshot());
  if (past.value.length > HISTORY_LIMIT) past.value.shift();
  future.value = [];
  dirty.value = true;
}

const canUndo = computed(() => past.value.length > 0);
const canRedo = computed(() => future.value.length > 0);

function undo() {
  const prev = past.value.pop();
  if (!prev) return;
  future.value.push(snapshot());
  panes.value = prev;
  if (!panes.value.some(pane => pane.pk === selectedPk.value)) {
    selectedPk.value = "";
  }
  dirty.value = true;
}

function redo() {
  const next = future.value.pop();
  if (!next) return;
  past.value.push(snapshot());
  panes.value = next;
  dirty.value = true;
}

/* ---------------- 组件库：新增窗格 ---------------- */
function addPane(type: ScreenPaneType, dashboard?: string, at?: PaneBox) {
  if (panes.value.length >= MAX_PANES) {
    message(t("dataScreen.panesFull", { max: MAX_PANES }), { type: "warning" });
    return;
  }
  const size = PANE_DEFAULTS[type];
  // 指定落点（组件库拖拽 drop）且可放则就地落格，否则行优先找首个空位
  const slot =
    at && canPlace(panes.value, at)
      ? clampBox(at)
      : findSlot(panes.value, size.w, size.h);
  if (!slot) {
    message(t("dataScreen.canvasFull"), { type: "warning" });
    return;
  }
  pushHistory();
  const pane: ScreenLayoutPane = {
    pk: genPaneId(),
    type,
    ...slot,
    ...(type === "dashboard" ? { dashboard } : {}),
    ...(type === "text" ? { text: "", align: "left", size: 24 } : {}),
    ...(type === "clock" ? { size: 40 } : {}),
    ...(type === "metric" ? { metric: "count" } : {}),
    ...(type === "image" ? { url: "", fit: "cover" } : {})
  };
  panes.value.push(pane);
  selectedPk.value = pane.pk;
}

/** 复制选中窗格（新 pk + 找空位；同类型属性原样保留） */
function duplicateSelected() {
  const source = selected.value;
  if (!source) return;
  if (panes.value.length >= MAX_PANES) {
    message(t("dataScreen.panesFull", { max: MAX_PANES }), { type: "warning" });
    return;
  }
  // 先试右下相邻位（平铺复制的手感），不行再回落首个空位
  const near = clampBox({
    x: source.x + 1,
    y: source.y + 1,
    w: source.w,
    h: source.h
  });
  const slot = canPlace(panes.value, near)
    ? near
    : findSlot(panes.value, source.w, source.h);
  if (!slot) {
    message(t("dataScreen.canvasFull"), { type: "warning" });
    return;
  }
  pushHistory();
  const pane: ScreenLayoutPane = { ...source, ...slot, pk: genPaneId() };
  panes.value.push(pane);
  selectedPk.value = pane.pk;
}

/* ---------------- 画布交互：选中 / 拖拽 / 缩放 ---------------- */
let dragState:
  | {
      mode: "move" | "resize";
      index: number;
      startBox: PaneBox;
      startX: number;
      startY: number;
    }
  | undefined;

function startTracking(
  mode: "move" | "resize",
  pk: string,
  event: PointerEvent
) {
  const index = panes.value.findIndex(pane => pane.pk === pk);
  if (index < 0) return;
  const { x, y, w, h } = panes.value[index];
  pushHistory(`drag-${pk}-${mode}`);
  dragState = {
    mode,
    index,
    startBox: { x, y, w, h },
    startX: event.clientX,
    startY: event.clientY
  };
  selectedPk.value = pk;
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", stopPointerTracking);
}

function onPointerMove(event: PointerEvent) {
  if (!dragState) return;
  const { stepX, stepY } = metrics();
  const dx = Math.round((event.clientX - dragState.startX) / stepX);
  const dy = Math.round((event.clientY - dragState.startY) / stepY);
  const { startBox, index, mode } = dragState;
  const next =
    mode === "move"
      ? clampBox({ ...startBox, x: startBox.x + dx, y: startBox.y + dy })
      : clampBox({ ...startBox, w: startBox.w + dx, h: startBox.h + dy });
  // 落点非法（与其他窗格重叠）时保持原位：拖回可放区域即继续跟随，无需重按
  if (!canPlace(panes.value, next, index)) return;
  panes.value[index] = { ...panes.value[index], ...next };
  dirty.value = true;
}

function stopPointerTracking() {
  dragState = undefined;
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", stopPointerTracking);
}

function removePane(pk: string) {
  if (!panes.value.some(pane => pane.pk === pk)) return;
  pushHistory();
  panes.value = panes.value.filter(pane => pane.pk !== pk);
  if (selectedPk.value === pk) selectedPk.value = "";
}

/* ---------------- 组件库拖拽落点 ---------------- */
const PALETTE_MIME = "application/x-screen-pane";

function onPaletteDragStart(
  event: DragEvent,
  type: ScreenPaneType,
  dashboard?: string
) {
  event.dataTransfer?.setData(
    PALETTE_MIME,
    JSON.stringify({ type, dashboard })
  );
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
}

function onCanvasDrop(event: DragEvent) {
  const raw = event.dataTransfer?.getData(PALETTE_MIME);
  if (!raw) return;
  let payload: { type: ScreenPaneType; dashboard?: string };
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }
  const canvas = canvasRef.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const { stepX } = metrics();
  const size = PANE_DEFAULTS[payload.type];
  const cell = cellFromOffset(
    event.clientX - rect.left - CANVAS_PADDING,
    event.clientY - rect.top - CANVAS_PADDING,
    { cellW: stepX - GAP_X, cellH: ROW_HEIGHT, gapX: GAP_X, gapY: GAP_Y }
  );
  addPane(payload.type, payload.dashboard, {
    x: cell.x,
    y: cell.y,
    w: size.w,
    h: size.h
  });
}

/* ---------------- 属性面板 ---------------- */
const BOX_KEYS = ["x", "y", "w", "h"] as const;

function updatePane(patch: Partial<ScreenLayoutPane>) {
  const index = panes.value.findIndex(pane => pane.pk === selectedPk.value);
  if (index < 0) return;
  const boxKey = BOX_KEYS.find(key => key in patch);
  const otherKey = Object.keys(patch).find(
    key => !BOX_KEYS.includes(key as (typeof BOX_KEYS)[number])
  );
  const merged = { ...panes.value[index], ...patch };
  // 位置/尺寸改动与拖拽同一口径：夹回栅格后仍重叠则驳回（避免保存时才被服务端 400 打回）
  if (boxKey) {
    const box = clampBox({
      x: merged.x,
      y: merged.y,
      w: merged.w,
      h: merged.h
    });
    if (!canPlace(panes.value, box, index)) {
      message(t("dataScreen.overlapRejected"), { type: "warning" });
      return;
    }
    Object.assign(merged, box);
  }
  pushHistory(
    boxKey
      ? `box-${selectedPk.value}-${boxKey}`
      : otherKey
        ? `prop-${selectedPk.value}-${otherKey}`
        : undefined
  );
  panes.value[index] = merged;
}

/* ---------------- 键盘快捷键 ---------------- */
/** 焦点在输入控件（输入框 / 文本域 / 选择器等）时不劫持按键 */
function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.isContentEditable ||
    Boolean(el.closest(".el-select, .el-input-number, .el-date-editor"))
  );
}

function onKeydown(event: KeyboardEvent) {
  if (preview.value) return;
  const mod = event.ctrlKey || event.metaKey;
  if (mod && event.key.toLowerCase() === "s") {
    event.preventDefault();
    void save();
    return;
  }
  if (mod && event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
    return;
  }
  if (mod && event.key.toLowerCase() === "y") {
    event.preventDefault();
    redo();
    return;
  }
  if (isTypingTarget(event.target)) return;
  if (mod && event.key.toLowerCase() === "d") {
    event.preventDefault();
    duplicateSelected();
    return;
  }
  if (!selected.value) return;
  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    removePane(selectedPk.value);
    return;
  }
  if (event.key === "Escape") {
    selectedPk.value = "";
    return;
  }
  const index = panes.value.findIndex(pane => pane.pk === selectedPk.value);
  if (index < 0) return;
  const pane = panes.value[index];
  const move: Record<string, [number, number]> = {
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0]
  };
  const delta = move[event.key];
  if (!delta) return;
  event.preventDefault();
  const next = event.shiftKey
    ? clampBox({ ...pane, w: pane.w + delta[0], h: pane.h + delta[1] })
    : clampBox({ ...pane, x: pane.x + delta[0], y: pane.y + delta[1] });
  if (!canPlace(panes.value, next, index)) return;
  pushHistory(
    `nudge-${pane.pk}-${event.key}-${event.shiftKey ? "size" : "move"}`
  );
  panes.value[index] = { ...pane, ...next };
}

/* ---------------- 未保存守卫 ---------------- */
const onBeforeUnload = (event: BeforeUnloadEvent) => {
  if (!dirty.value) return;
  event.preventDefault();
  event.returnValue = "";
};

onBeforeRouteLeave(async () => {
  if (!dirty.value) return true;
  try {
    await ElMessageBox.confirm(
      t("dataScreen.leaveConfirm"),
      t("dataScreen.unsaved"),
      {
        type: "warning",
        confirmButtonText: t("dataScreen.leave"),
        cancelButtonText: t("dataScreen.stay")
      }
    );
    return true;
  } catch {
    return false;
  }
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
      coalesceKey = "";
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
  try {
    await ElMessageBox.confirm(
      t("dataScreen.clearLayoutConfirm"),
      t("dataScreen.clearLayout"),
      { type: "warning" }
    );
  } catch {
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
      <aside v-if="!preview" class="designer-palette">
        <div class="designer-palette__title">{{ t("dataScreen.palette") }}</div>
        <el-button
          class="w-full"
          draggable="true"
          data-testid="palette-metric"
          @click="addPane('metric')"
          @dragstart="onPaletteDragStart($event, 'metric')"
        >
          {{ t("dataScreen.paneMetric") }}
        </el-button>
        <el-button
          class="w-full"
          draggable="true"
          data-testid="palette-image"
          @click="addPane('image')"
          @dragstart="onPaletteDragStart($event, 'image')"
        >
          {{ t("dataScreen.paneImage") }}
        </el-button>
        <el-button
          class="w-full"
          draggable="true"
          data-testid="palette-text"
          @click="addPane('text')"
          @dragstart="onPaletteDragStart($event, 'text')"
        >
          {{ t("dataScreen.paneText") }}
        </el-button>
        <el-button
          class="w-full"
          draggable="true"
          data-testid="palette-clock"
          @click="addPane('clock')"
          @dragstart="onPaletteDragStart($event, 'clock')"
        >
          {{ t("dataScreen.paneClock") }}
        </el-button>
        <el-divider />
        <div class="designer-palette__title">
          {{ t("dataScreen.paneDashboard") }}
        </div>
        <div class="designer-palette__list">
          <el-button
            v-for="item in dashboards"
            :key="item.pk"
            class="w-full"
            draggable="true"
            data-testid="palette-dashboard"
            @click="addPane('dashboard', item.pk)"
            @dragstart="onPaletteDragStart($event, 'dashboard', item.pk)"
          >
            {{ item.name }}
          </el-button>
          <span v-if="dashboards.length === 0" class="designer-hint">
            {{ t("dataScreen.noDashboards") }}
          </span>
        </div>
        <el-divider />
        <div class="designer-hint">{{ t("dataScreen.shortcutsHint") }}</div>
      </aside>

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

.designer-palette,
.designer-inspector {
  flex: none;
  width: 220px;
  padding: 14px 12px;
  overflow: auto;
  background: rgb(255 255 255 / 3%);
}

.designer-palette {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-right: 1px solid rgb(255 255 255 / 8%);

  /* EP 的 `.el-button + .el-button { margin-left: 12px }` 是横向按钮组语义，
     纵向组件库里会把第 2 个起的按钮整体顶右 12px（含仪表盘清单），统一清零 */
  :deep(.el-button + .el-button) {
    margin-left: 0;
  }
}

.designer-palette__title {
  font-size: var(--el-font-size-small);
  color: rgb(255 255 255 / 70%);
}

.designer-palette__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 40vh;
  overflow: auto;
}

.designer-inspector {
  width: 260px;
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
