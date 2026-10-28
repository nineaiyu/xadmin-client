<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import type { DashboardCard } from "@/api/dataset/datasets";
import ScreenPane from "./ScreenPane.vue";

defineOptions({ name: "ScreenFreeStage" });

/**
 * 自由画布投屏舞台：按基准设计画幅固定尺寸渲染，整体 `transform: scale(k)`
 * 等比适配容器（`k = min(容器宽 / 设计宽, 容器高 / 设计高)`），居中并留 letterbox——
 * 字号与间距随整体缩放，不会出现「分区拉伸变形」；缩放只作用于展示、不写回数据。
 *
 * `ResizeObserver` 监听容器尺寸变化重算；窗格渲染复用 `ScreenPane`
 * （与栅格画布同一组件、同一深色视觉），刷新 / 导出 / 远程控制与栅格态等价。
 */
const props = defineProps<{
  /** 可见窗格（px 坐标；数组顺序即层级，后者在上） */
  panes: ScreenLayoutPane[];
  design: { design_w: number; design_h: number };
  clock?: string;
  paneCards: (_pane: ScreenLayoutPane) => DashboardCard[];
  paneTitle: (_pane: ScreenLayoutPane) => string;
  /** 窗格句柄收集（刷新与导出统一遍历） */
  setPaneRef?: (_pk: string) => (_el: unknown) => void;
}>();

const wrapRef = ref<HTMLElement>();
const scale = ref(1);
let observer: ResizeObserver | undefined;

/** 等比因子：contain（两边取小），任一维小于设计画幅即整体缩小 */
const updateScale = () => {
  const wrap = wrapRef.value;
  const { design_w: width, design_h: height } = props.design;
  if (!wrap || width <= 0 || height <= 0) return;
  scale.value = Math.min(wrap.clientWidth / width, wrap.clientHeight / height);
};

onMounted(() => {
  updateScale();
  observer = new ResizeObserver(updateScale);
  if (wrapRef.value) observer.observe(wrapRef.value);
});

onBeforeUnmount(() => observer?.disconnect());

const stageStyle = computed(() => ({
  width: `${props.design.design_w}px`,
  height: `${props.design.design_h}px`,
  transform: `scale(${scale.value})`
}));
</script>

<template>
  <div
    ref="wrapRef"
    class="screen-free"
    data-testid="screen-free"
    :data-design-w="design.design_w"
    :data-design-h="design.design_h"
  >
    <div
      class="screen-free__stage"
      :style="stageStyle"
      :data-scale="scale.toFixed(4)"
      data-testid="screen-free-stage"
    >
      <!-- 与设计器同源的窗格定位包裹层：设计器经 ReResize 按 x/y/w/h 摆放
           （自由模式 ScreenPane 自身 inset:0 只负责填满包裹层），投屏缺这层
           会让全部窗格铺满舞台并互相覆盖。数组顺序即层级，与设计器 z 序一致。 -->
      <div
        v-for="(pane, index) in panes"
        :key="pane.pk"
        class="screen-free__pane-box"
        :style="{
          left: `${pane.x}px`,
          top: `${pane.y}px`,
          width: `${pane.w}px`,
          height: `${pane.h}px`,
          zIndex: index + 1
        }"
        :data-testid="`screen-free-pane-box-${pane.pk}`"
      >
        <ScreenPane
          :ref="setPaneRef?.(pane.pk)"
          layout="free"
          play-animation
          :pane="pane"
          :cards="paneCards(pane)"
          :clock="clock"
          :dashboard-name="paneTitle(pane)"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* letterbox 区域用画布底色；舞台按设计画幅固定尺寸后整体缩放（transform-origin 居中，
   flex 居中后视觉中心与容器中心重合，缩放不会偏移） */
.screen-free {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
  overflow: hidden;
  background: var(--screen-canvas);
}

.screen-free__stage {
  position: relative;
  flex: none;
  transform-origin: center;
}

.screen-free__pane-box {
  position: absolute;
}
</style>
