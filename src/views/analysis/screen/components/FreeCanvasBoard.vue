<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { ScreenLayoutPane, ScreenPaneType } from "@/api/dataset/analysis";
import type { DashboardCard, DashboardItem } from "@/api/dataset/datasets";
import { ReResize, type Box } from "@/components/ReResize";
import ScreenPane from "./ScreenPane.vue";
import { FREE_MIN_PANE_SIZE, type FreeDesign } from "../utils/freeLayout";
import type { FreeGridSnap } from "../utils/freeSnap";
import {
  guideStyle,
  rectStyle,
  useFreeBoardGestures
} from "../utils/freeBoardGestures";
import { ZOOM_VIEWPORT_PADDING } from "../utils/viewport";

defineOptions({ name: "ScreenFreeCanvasBoard" });

/**
 * 自由画布设计区（设计器内嵌）：按基准设计画幅渲染，stage 占位尺寸随**显示缩放**
 * 变化（`transform: scale` + 滚动容器，换算见 utils/viewport.ts）。
 *
 * - 窗格由 `ReResize` 承接拖动与八向缩放（父容器约束、最小 16px、按 `scale` 换算增量），
 *   停手落数据；
 * - 多选 / 组拖动 / 框选 / 吸附参考线 / 组件库拖放的手势与几何在
 *   utils/freeBoardGestures.ts（行数门禁抽出），算好后上抛、组合层只写数据；
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

/** 手势层（选中 / 组拖动 / 框选 / 吸附 / 拖放，见 utils/freeBoardGestures.ts） */
const {
  guides,
  marquee,
  groupBounds,
  isChosen,
  snapFor,
  onSnapping,
  onPanePointerDown,
  onDragging,
  onDeactivated,
  onCanvasPointerDown,
  onDrop
} = useFreeBoardGestures({
  panes: computed(() => props.panes),
  selection: computed(() => props.selection),
  design: computed(() => props.design),
  editable: computed(() => props.editable),
  gridSnap: computed(() => props.gridSnap),
  zoom,
  canvasRef,
  emit
});
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
