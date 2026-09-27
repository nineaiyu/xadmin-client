<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { ElMessageBox } from "element-plus";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import {
  listDashboards,
  screenApi,
  type ScreenItem,
  type ScreenLayoutPane,
  type ScreenPaneType
} from "@/api/dataset/analysis";
import type { DashboardItem } from "@/api/dataset/datasets";
import ScreenPane from "./components/ScreenPane.vue";
import PaneInspector from "./components/PaneInspector.vue";
import {
  GRID_COLS,
  MAX_PANES,
  PANE_DEFAULTS,
  canPlace,
  clampBox,
  findSlot,
  genPaneId,
  normalizePanes,
  type PaneBox
} from "./utils/layout";

defineOptions({ name: "DataScreenDesigner" });

/**
 * 大屏画布设计器（P2.2 批次一）。
 *
 * 形态：左侧组件库（仪表盘 / 文本 / 时钟）→ 画布（12 列栅格，拖拽移动 + 右下角缩放）
 * → 右侧属性面板 → 顶部保存/预览。画布与投屏页共用 `ScreenPane`，所见即所得。
 *
 * 交互口径：
 * - 拖拽/缩放都先算「格数增量」再夹回栅格，落点与其他窗格重叠时**保持原位**（不弹错）；
 * - 新增窗格自动找首个空位（`findSlot`），画布排满给出可读提示；
 * - 保存前本地归一化（丢未声明键、按类型补默认值），服务端仍会再校验一次（双保险）。
 * - `layout` 清空即回到轮播模式（存量形态与既有 E2E 不受影响）。
 */
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const screen = ref<ScreenItem | null>(null);
const dashboards = ref<DashboardItem[]>([]);
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

const selected = computed(() =>
  panes.value.find(pane => pane.pk === selectedPk.value)
);
const dashboardName = (pk?: string) =>
  dashboards.value.find(item => item.pk === pk)?.name ?? "";
const cardsOf = (pane: ScreenLayoutPane) =>
  dashboards.value.find(item => item.pk === pane.dashboard)?.layout ?? [];

const metrics = () => {
  const width = canvasRef.value?.clientWidth ?? 0;
  const stepX = width > 0 ? (width + GAP_X) / GRID_COLS : 1;
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
  dashboards.value = await listDashboards();
  loading.value = false;
  clock.value = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  clockTimer = window.setInterval(() => {
    clock.value = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  }, 1000);
});

onBeforeUnmount(() => {
  window.clearInterval(clockTimer);
  stopPointerTracking();
});

/* ---------------- 组件库：新增窗格 ---------------- */
function addPane(type: ScreenPaneType, dashboard?: string) {
  if (panes.value.length >= MAX_PANES) {
    message(t("dataScreen.panesFull", { max: MAX_PANES }), { type: "warning" });
    return;
  }
  const size = PANE_DEFAULTS[type];
  const slot = findSlot(panes.value, size.w, size.h);
  if (!slot) {
    message(t("dataScreen.canvasFull"), { type: "warning" });
    return;
  }
  const pane: ScreenLayoutPane = {
    pk: genPaneId(),
    type,
    ...slot,
    ...(type === "dashboard" ? { dashboard } : {}),
    ...(type === "text" ? { text: "", align: "left", size: 24 } : {})
  };
  panes.value.push(pane);
  selectedPk.value = pane.pk;
  dirty.value = true;
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
  panes.value = panes.value.filter(pane => pane.pk !== pk);
  if (selectedPk.value === pk) selectedPk.value = "";
  dirty.value = true;
}

/* ---------------- 属性面板 ---------------- */
const BOX_KEYS = ["x", "y", "w", "h"] as const;

function updatePane(patch: Partial<ScreenLayoutPane>) {
  const index = panes.value.findIndex(pane => pane.pk === selectedPk.value);
  if (index < 0) return;
  const merged = { ...panes.value[index], ...patch };
  // 位置/尺寸改动与拖拽同一口径：夹回栅格后仍重叠则驳回（避免保存时才被服务端 400 打回）
  if (BOX_KEYS.some(key => key in patch)) {
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
  panes.value[index] = merged;
  dirty.value = true;
}

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
      message(t("dataScreen.layoutSaved"), { type: "success" });
      return;
    }
    if (res.detail) message(String(res.detail), { type: "warning" });
  } finally {
    saving.value = false;
  }
}

async function clearCanvas() {
  try {
    await ElMessageBox.confirm(
      t("dataScreen.clearLayoutConfirm"),
      t("dataScreen.clearLayout"),
      { type: "warning" }
    );
  } catch {
    return;
  }
  panes.value = [];
  selectedPk.value = "";
  dirty.value = true;
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
          data-testid="palette-text"
          @click="addPane('text')"
        >
          {{ t("dataScreen.paneText") }}
        </el-button>
        <el-button
          class="w-full"
          data-testid="palette-clock"
          @click="addPane('clock')"
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
            data-testid="palette-dashboard"
            @click="addPane('dashboard', item.pk)"
          >
            {{ item.name }}
          </el-button>
          <span v-if="dashboards.length === 0" class="designer-hint">
            {{ t("dataScreen.noDashboards") }}
          </span>
        </div>
      </aside>

      <main
        ref="canvasRef"
        class="designer-canvas"
        :class="{ 'is-preview': preview }"
        data-testid="designer-canvas"
        @pointerdown.self="selectedPk = ''"
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
