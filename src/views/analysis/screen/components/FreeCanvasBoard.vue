<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { ScreenLayoutPane, ScreenPaneType } from "@/api/dataset/analysis";
import type { DashboardCard, DashboardItem } from "@/api/dataset/datasets";
import { ReResize, type Box } from "@/components/ReResize";
import ScreenPane from "./ScreenPane.vue";
import {
  FREE_MIN_PANE_SIZE,
  FREE_PANE_DEFAULTS,
  freeBoxFromOffset,
  type FreeDesign
} from "../utils/freeLayout";
import {
  FREE_SNAP_THRESHOLD,
  snapFreeBox,
  type FreeGridSnap,
  type FreeSnapGuide
} from "../utils/freeSnap";
import {
  panesInRect,
  rectFromPoints,
  selectionBounds,
  type FreeRect
} from "../utils/freeSelect";
import { parsePaletteDrop } from "../utils/dnd";
import { ZOOM_VIEWPORT_PADDING } from "../utils/viewport";

defineOptions({ name: "ScreenFreeCanvasBoard" });

/**
 * 自由画布设计区（设计器内嵌）：按基准设计画幅渲染，stage 占位尺寸随**显示缩放**
 * 变化（`transform: scale` + 滚动容器，换算见 utils/viewport.ts）。
 *
 * - 窗格由 `ReResize` 承接拖动与八向缩放（父容器约束、最小 16px、按 `scale` 换算增量），
 *   停手落数据；
 * - **多选**：按下即选中（未在选区内则单选，`Shift/⌘` 为加选/减选）；空白处拖拽 = 框选
 *   （矩形与窗格求交）；拖动选区内任一窗格 = **整组跟随**——按「起手快照」统一夹回画幅，
 *   几何在此算好后上抛整组盒模型（组合层只写数据，不重复算几何）；
 * - 吸附参考线：`snap` 钩子（画幅边界 / 中线 + 其他窗格边框与中性线），命中绘制引导线；
 * - 组包围盒与框选矩形都画在**画布坐标系**内（随 zoom 一起缩放）。
 */
const props = defineProps<{
  /** 自由画布窗格（px 坐标；数组顺序即层级，后者在上） */
  panes: ScreenLayoutPane[];
  design: FreeDesign;
  /** 当前选区（数组顺序 = 加入顺序，末位为主选） */
  selection: string[];
  /** 可编辑（预览 / 只读态为 false：不接手势） */
  editable: boolean;
  clock?: string;
  dashboards: DashboardItem[];
  /** 显示缩放因子（只影响渲染与指针换算） */
  zoom?: number;
  /** 窗格句柄收集（设计器「刷新数据」按模式统一遍历） */
  setPaneRef?: (_pk: string) => (_el: unknown) => void;
  /** 滚轮处理（Ctrl/⌘ + 滚轮缩放由组合层处理，普通滚轮交回容器滚动） */
  wheelHandler?: (_event: WheelEvent) => void;
  /** 元素级网格吸附（缺省不传 = 关闭，行为与一期一致） */
  gridSnap?: FreeGridSnap;
  /** 播放窗格入场动画（仅预览 / 展示态，编辑态不播） */
  playAnimation?: boolean;
}>();

const emit = defineEmits<{
  /** 选中：`pk` 为空串表示清空；`additive` = Shift/⌘ 加选（点在已选项上为减选） */
  select: [payload: { pk: string; additive: boolean }];
  /** 框选结果 */
  selectMany: [payload: { pks: string[]; additive: boolean }];
  remove: [pk: string];
  /** 组拖动：整组新盒模型（锚点也在其中；撤销点由组合层记一个） */
  groupMove: [payload: { pk: string; boxes: Record<string, Box> }];
  /** 手势停手：落数据（是否记撤销点由组合层按手势语义判定） */
  boxStop: [payload: { pk: string; box: Box; gesture: "move" | "resize" }];
  /** 组件库拖放：类型 + 画布内落点（px，越界已夹回） */
  drop: [payload: { type: ScreenPaneType; dashboard?: string; box: Box }];
}>();

const { t } = useI18n();

const viewportEl = ref<HTMLElement>();
const canvasRef = ref<HTMLElement>();
defineExpose({ viewportEl, canvasEl: canvasRef });

const guides = ref<FreeSnapGuide[]>([]);
const marquee = ref<FreeRect | null>(null);
/** 组拖动起手快照：首次移动时捕获，手势期间不随数据变化（避免夹取累积） */
let groupStart: {
  pk: string;
  boxes: Record<string, Box>;
  bounds: FreeRect;
} | null = null;
let marqueeStart: { x: number; y: number; additive: boolean } | null = null;

const zoom = computed(() => (props.zoom && props.zoom > 0 ? props.zoom : 1));
const stageStyle = computed(() => ({
  width: `${props.design.design_w * zoom.value + ZOOM_VIEWPORT_PADDING * 2}px`,
  height: `${props.design.design_h * zoom.value + ZOOM_VIEWPORT_PADDING * 2}px`
}));
const canvasStyle = computed(() => ({
  width: `${props.design.design_w}px`,
  height: `${props.design.design_h}px`,
  transform: `scale(${zoom.value})`
}));

const dashboardName = (pk?: string) =>
  props.dashboards.find(item => item.pk === pk)?.name ?? "";
const cardsOf = (pane: ScreenLayoutPane): DashboardCard[] =>
  props.dashboards.find(item => item.pk === pane.dashboard)?.layout ?? [];

const isChosen = (pk: string) => props.selection.includes(pk);
const groupMode = computed(() => props.selection.length > 1);
const groupBounds = computed(() =>
  groupMode.value ? selectionBounds(props.panes, props.selection) : null
);

/** 指针坐标 → 画布内数据坐标（先减画布矩形起点、再除以缩放因子） */
function toData(event: PointerEvent | DragEvent): { x: number; y: number } {
  const canvas = canvasRef.value;
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / zoom.value,
    y: (event.clientY - rect.top) / zoom.value
  };
}

/** 起手快照：组内各窗格的盒模型 + 选区包围盒（组夹取以此为基准） */
function snapshot(): { boxes: Record<string, Box>; bounds: FreeRect } {
  const boxes: Record<string, Box> = {};
  for (const pane of props.panes) {
    if (isChosen(pane.pk)) {
      boxes[pane.pk] = { x: pane.x, y: pane.y, w: pane.w, h: pane.h };
    }
  }
  return {
    boxes,
    bounds: selectionBounds(props.panes, props.selection) ?? {
      x: 0,
      y: 0,
      w: 0,
      h: 0
    }
  };
}

/** 整组夹取：任何一个成员都不得越出画幅（越界即整组停住） */
function clampDelta(bounds: FreeRect, dx: number, dy: number) {
  return {
    dx: Math.min(
      Math.max(dx, -bounds.x),
      props.design.design_w - (bounds.x + bounds.w)
    ),
    dy: Math.min(
      Math.max(dy, -bounds.y),
      props.design.design_h - (bounds.y + bounds.h)
    )
  };
}

/** 吸附候选 = 其他窗格；组拖动时再按起手快照做整组夹取 */
const snapFor = (pk: string) => (box: Box, dir: string) => {
  const result = snapFreeBox(
    box,
    props.panes.filter(pane => pane.pk !== pk),
    props.design,
    dir,
    FREE_SNAP_THRESHOLD,
    props.gridSnap,
    // 旋转窗格按视觉盒吸附（ADR-090 D2）：把本窗格的旋转角带进去
    props.panes.find(pane => pane.pk === pk)?.rotate ?? 0
  );
  if (dir || !groupMode.value || !isChosen(pk)) return result;
  const start = groupStart ?? (groupStart = { pk, ...snapshot() });
  const anchor = start.boxes[pk];
  if (!anchor) return result;
  const delta = clampDelta(
    start.bounds,
    result.box.x - anchor.x,
    result.box.y - anchor.y
  );
  return {
    box: { ...result.box, x: anchor.x + delta.dx, y: anchor.y + delta.dy },
    guides: result.guides
  };
};

const onSnapping = (next: unknown[]) => {
  guides.value = next as FreeSnapGuide[];
};

const guideStyle = (guide: FreeSnapGuide) =>
  guide.axis === "x"
    ? { left: `${guide.position}px` }
    : { top: `${guide.position}px` };

const rectStyle = (rect: FreeRect) => ({
  left: `${rect.x}px`,
  top: `${rect.y}px`,
  width: `${rect.w}px`,
  height: `${rect.h}px`
});

/** 按下即选中：已在选区内保持不动（才能直接整组拖动），Shift/⌘ 为加选/减选 */
function onPanePointerDown(pk: string, event: PointerEvent) {
  if (!props.editable || event.button !== 0) return;
  const additive = event.shiftKey || event.metaKey || event.ctrlKey;
  if (additive) {
    emit("select", { pk, additive: true });
    return;
  }
  if (!isChosen(pk)) emit("select", { pk, additive: false });
}

function onDragging(pk: string, x: number, y: number) {
  if (!groupMode.value || !isChosen(pk) || groupStart?.pk !== pk) return;
  const anchor = groupStart.boxes[pk];
  if (!anchor) return;
  const delta = clampDelta(groupStart.bounds, x - anchor.x, y - anchor.y);
  const boxes: Record<string, Box> = {};
  for (const [key, box] of Object.entries(groupStart.boxes)) {
    boxes[key] = { ...box, x: box.x + delta.dx, y: box.y + delta.dy };
  }
  emit("groupMove", { pk, boxes });
}

function onDeactivated() {
  guides.value = [];
  groupStart = null;
}

/* ---------------- 框选 ---------------- */

function onCanvasPointerDown(event: PointerEvent) {
  if (!props.editable || event.button !== 0) return;
  const start = toData(event);
  const additive = event.shiftKey || event.metaKey || event.ctrlKey;
  marqueeStart = { ...start, additive };
  if (!additive) emit("select", { pk: "", additive: false });
  marquee.value = rectFromPoints(start.x, start.y, start.x, start.y);
  window.addEventListener("pointermove", onMarqueeMove);
  window.addEventListener("pointerup", onMarqueeUp);
}

function onMarqueeMove(event: PointerEvent) {
  if (!marqueeStart) return;
  if (event.buttons === 0) {
    onMarqueeUp();
    return;
  }
  const point = toData(event);
  marquee.value = rectFromPoints(
    marqueeStart.x,
    marqueeStart.y,
    point.x,
    point.y
  );
}

function onMarqueeUp() {
  const rect = marquee.value;
  const additive = marqueeStart?.additive ?? false;
  marqueeStart = null;
  marquee.value = null;
  window.removeEventListener("pointermove", onMarqueeMove);
  window.removeEventListener("pointerup", onMarqueeUp);
  // 位移过小视为「点击空白」（清空选中已在按下时完成）
  if (!rect || (rect.w < 4 && rect.h < 4)) return;
  emit("selectMany", { pks: panesInRect(props.panes, rect), additive });
}

const onDrop = (event: DragEvent) => {
  const payload = parsePaletteDrop(event);
  const canvas = canvasRef.value;
  if (!payload || !canvas || !props.editable) return;
  const point = toData(event);
  emit("drop", {
    ...payload,
    box: freeBoxFromOffset(
      point.x,
      point.y,
      FREE_PANE_DEFAULTS[payload.type],
      props.design
    )
  });
};
</script>

<template>
  <div
    ref="viewportEl"
    class="free-board"
    data-testid="free-canvas-wrap"
    @wheel="wheelHandler?.($event)"
  >
    <div
      class="free-board__stage"
      :style="stageStyle"
      :data-zoom="zoom.toFixed(2)"
      data-testid="free-stage"
    >
      <div
        ref="canvasRef"
        class="free-board__canvas"
        :style="canvasStyle"
        data-testid="free-canvas"
        @pointerdown.self="onCanvasPointerDown"
        @dragover.prevent
        @drop.prevent="onDrop"
      >
        <ReResize
          v-for="(pane, index) in panes"
          :key="pane.pk"
          :x="pane.x"
          :y="pane.y"
          :w="pane.w"
          :h="pane.h"
          :z="index + 1"
          :minw="FREE_MIN_PANE_SIZE"
          :minh="FREE_MIN_PANE_SIZE"
          :scale="zoom"
          parent-limitation
          :is-draggable="editable"
          :is-resizable="editable"
          :active="editable && isChosen(pane.pk)"
          :snap="editable ? snapFor(pane.pk) : undefined"
          @pointerdown="onPanePointerDown(pane.pk, $event)"
          @dragging="(x, y) => onDragging(pane.pk, x, y)"
          @dragstop="
            (x, y) =>
              emit('boxStop', {
                pk: pane.pk,
                box: { x, y, w: pane.w, h: pane.h },
                gesture: 'move'
              })
          "
          @resizestop="
            (x, y, w, h) =>
              emit('boxStop', {
                pk: pane.pk,
                box: { x, y, w, h },
                gesture: 'resize'
              })
          "
          @snapping="onSnapping"
          @deactivated="onDeactivated"
        >
          <ScreenPane
            :ref="setPaneRef?.(pane.pk)"
            :pane="pane"
            layout="free"
            :cards="cardsOf(pane)"
            :clock="clock"
            :dashboard-name="dashboardName(pane.dashboard)"
            :editable="editable"
            :play-animation="playAnimation"
            @remove="emit('remove', pane.pk)"
          />
        </ReResize>

        <div
          v-for="guide in guides"
          :key="`${guide.axis}-${guide.position}`"
          class="free-board__guide"
          :class="`free-board__guide--${guide.axis}`"
          :style="guideStyle(guide)"
          data-testid="free-guide"
        />
        <div
          v-if="groupBounds"
          class="free-board__group"
          :style="rectStyle(groupBounds)"
          data-testid="free-group-bounds"
        />
        <div
          v-if="marquee"
          class="free-board__marquee"
          :style="rectStyle(marquee)"
          data-testid="free-marquee"
        />
        <span v-if="editable && panes.length === 0" class="free-board__empty">
          {{ t("dataScreen.emptyCanvas") }}
        </span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* 滚动容器 + stage 占位（stage 尺寸随 zoom 变化，滚动条才能覆盖缩放后的真实范围）；
   stage 的固定留白不参与缩放，画布以 transform 缩放（origin 左上） */
.free-board {
  flex: 1;
  min-width: 0;
  overflow: auto;
  background: var(--screen-canvas);
}

.free-board__stage {
  box-sizing: border-box;
  padding: 16px;
}

.free-board__canvas {
  position: relative;
  background-color: var(--screen-canvas-top);
  background-image: radial-gradient(var(--screen-grid-line) 1px, transparent 0);
  background-size: 24px 24px;
  border: 1px solid var(--screen-border);
  transform-origin: 0 0;
}

/* 吸附参考线：随 dragging / resizing 实时更新，停手清空 */
.free-board__guide {
  position: absolute;
  z-index: 999;
  pointer-events: none;
  background: var(--el-color-primary);

  &--x {
    top: 0;
    bottom: 0;
    width: 1px;
  }

  &--y {
    right: 0;
    left: 0;
    height: 1px;
  }
}

/* 组包围盒（虚线）与框选矩形：都画在画布坐标系内，随 zoom 一起缩放 */
.free-board__group {
  position: absolute;
  z-index: 900;
  pointer-events: none;
  border: 1px dashed var(--el-color-primary);
}

.free-board__marquee {
  position: absolute;
  z-index: 901;
  pointer-events: none;
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary);
}

.free-board__empty {
  position: absolute;
  top: 50%;
  left: 50%;
  font-size: var(--el-font-size-base);
  color: var(--screen-fg-faint);
  transform: translate(-50%, -50%);
}
</style>
