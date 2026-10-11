<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import type { ScreenLayoutPane, ScreenPaneType } from "@/api/dataset/analysis";
import type { DashboardCard, DashboardItem } from "@/api/dataset/datasets";
import ScreenPane from "./ScreenPane.vue";
import { canvasGridVars, gridMetrics, type PaneBox } from "../utils/layout";
import { createCanvasDropHandler } from "../utils/dnd";

defineOptions({ name: "ScreenGridCanvasBoard" });

/**
 * 栅格画布设计区（设计器内嵌）：12 列栅格绝对定位（列/行步长走 `layout.ts` 常量
 * 派生的 CSS 变量，与投屏页同一份来源，保证所见即所得）。
 *
 * 拖动 / 缩放的手势与格步进由设计器持有（`utils/canvasDrag`）——本组件只渲染窗格、
 * 上抛 `pointerdown`，并经 `defineExpose({ canvasEl })` 交出画布元素供设计器做
 * 像素 → 格数换算；组件库拖放按指针换算格下标后上抛落点（越界由服务端口径兜底）。
 */
const props = defineProps<{
  /** 栅格窗格（x/y 为列/行下标） */
  panes: ScreenLayoutPane[];
  selectedPk: string;
  /** 可编辑（预览 / 只读态为 false：不接手势） */
  editable: boolean;
  loading: boolean;
  preview: boolean;
  clock?: string;
  dashboards: DashboardItem[];
  /** 窗格句柄收集（设计器「刷新数据」按模式统一遍历） */
  setPaneRef?: (_pk: string) => (_el: unknown) => void;
}>();

const emit = defineEmits<{
  select: [pk: string];
  remove: [pk: string];
  dragStart: [payload: { pk: string; event: PointerEvent }];
  resizeStart: [payload: { pk: string; event: PointerEvent }];
  /** 组件库拖放：类型 + 换算后的落点格 */
  drop: [payload: { type: ScreenPaneType; dashboard?: string; at: PaneBox }];
}>();

const { t } = useI18n();

const canvasRef = ref<HTMLElement>();
defineExpose({ canvasEl: canvasRef });

const dashboardName = (pk?: string) =>
  props.dashboards.find(item => item.pk === pk)?.name ?? "";
const cardsOf = (pane: ScreenLayoutPane): DashboardCard[] =>
  props.dashboards.find(item => item.pk === pane.dashboard)?.layout ?? [];

/** 落点换算与设计器拖拽同一份度量（`gridMetrics`） */
const metrics = () => gridMetrics(canvasRef.value?.clientWidth ?? 0);

const onDrop = createCanvasDropHandler({
  canvasRef,
  metrics,
  addPane: (type, dashboard, at) => {
    if (!props.editable || !at) return;
    emit("drop", { type, dashboard, at });
  }
});
</script>

<template>
  <main
    ref="canvasRef"
    class="grid-board"
    :class="{ 'is-preview': preview }"
    :style="canvasGridVars"
    data-testid="designer-canvas"
    @pointerdown.self="emit('select', '')"
    @dragover.prevent
    @drop.prevent="onDrop"
  >
    <span v-if="!loading && panes.length === 0" class="grid-board__empty">
      {{ t("dataScreen.emptyCanvas") }}
    </span>
    <ScreenPane
      v-for="pane in panes"
      :key="pane.pk"
      :ref="setPaneRef?.(pane.pk)"
      :pane="pane"
      :cards="cardsOf(pane)"
      :clock="clock"
      :dashboard-name="dashboardName(pane.dashboard)"
      :editable="editable"
      :selected="pane.pk === selectedPk"
      :play-animation="preview"
      @select="emit('select', $event)"
      @remove="emit('remove', $event)"
      @drag-start="emit('dragStart', $event)"
      @resize-start="emit('resizeStart', $event)"
    />
  </main>
</template>

<style lang="scss" scoped>
/* 画布栅格度量全部走 layout.ts 常量派生的 CSS 变量（:style 绑定 canvasGridVars），
   与投屏页同一份来源，保证所见即所得 */
.grid-board {
  position: relative;
  display: grid;
  flex: 1;
  grid-template-columns: repeat(var(--screen-grid-cols), minmax(0, 1fr));
  grid-auto-rows: var(--screen-row-height);

  /* 行距/列距是 layout.ts 里两个独立常量，刻意分写不用 gap 合并 */
  /* stylelint-disable-next-line declaration-block-no-redundant-longhand-properties */
  row-gap: var(--screen-gap-y);
  column-gap: var(--screen-gap-x);
  align-content: start;
  padding: var(--screen-canvas-padding);
  overflow: auto;
  background-image:
    linear-gradient(var(--screen-grid-line) 1px, transparent 0),
    linear-gradient(90deg, var(--screen-grid-line) 1px, transparent 0);
  background-size:
    100% var(--screen-row-step),
    calc(100% / var(--screen-grid-cols)) 100%;
}

.grid-board.is-preview {
  background-image: none;
}

.grid-board__empty {
  grid-column: 1 / -1;
  padding: var(--space-10) 0;
  color: var(--screen-fg-faint);
  text-align: center;
}
</style>
