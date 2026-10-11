<script lang="ts" setup>
import { computed, onBeforeUnmount, ref } from "vue";

import { dragBox, resizeBox, type Box, type BoxConstraints } from "./geometry";

defineOptions({ name: "ReResize" });

/**
 * 绝对定位的可拖拽 / 可缩放盒子：拖动移动、八向手柄缩放，可选等比与父容器约束。
 * 交互走 Pointer 事件（鼠标 / 触屏统一）；几何计算抽为纯函数（`geometry.ts`）以便单测。
 *
 * 何时用：需要「自由像素定位」的元素编辑（任意摆放 + 八向拉伸）。
 * 何时不用：栅格语义的画布——大屏 / 表单设计器走栅格步进 + 重叠保护 + 撤销合并
 * （`views/analysis/screen/utils/canvasDrag.ts`），强接会丢失吸附与碰撞检测。
 * 现无业务落点，在库待用；出现自由定位编辑场景时接入。
 */
const props = withDefaults(
  defineProps<{
    /** 宽 / 高（px） */
    w?: number;
    h?: number;
    /** 相对父容器左上角的位置（px） */
    x?: number;
    y?: number;
    /** 层级 */
    z?: number | string;
    /** 最小宽 / 高（px） */
    minw?: number;
    minh?: number;
    /** 是否可拖动 */
    isDraggable?: boolean;
    /** 是否可缩放 */
    isResizable?: boolean;
    /** 缩放保持等比 */
    aspectRatio?: boolean;
    /** 限制在父容器内 */
    parentLimitation?: boolean;
    /** 拖动把手选择器（命中其中元素才可拖动；空 = 整块可拖） */
    dragHandle?: string;
    /** 缩放手柄方位 */
    sticks?: string[];
    /** 激活态（高亮描边） */
    active?: boolean;
    /** 内容区类名 */
    contentClass?: string;
  }>(),
  {
    w: 200,
    h: 200,
    x: 0,
    y: 0,
    z: "auto",
    minw: 20,
    minh: 20,
    isDraggable: true,
    isResizable: true,
    aspectRatio: false,
    parentLimitation: false,
    dragHandle: "",
    sticks: () => ["tl", "tm", "tr", "mr", "br", "bm", "bl", "ml"],
    active: false,
    contentClass: ""
  }
);

const emit = defineEmits<{
  clicked: [event: MouseEvent];
  dragging: [x: number, y: number];
  dragstop: [x: number, y: number];
  resizing: [x: number, y: number, w: number, h: number];
  resizestop: [x: number, y: number, w: number, h: number];
  activated: [];
  deactivated: [];
}>();

const box = ref<Box>({ x: props.x, y: props.y, w: props.w, h: props.h });
const rootRef = ref<HTMLElement>();

/** 以当前父容器实测尺寸构造约束 */
function constraints(): BoxConstraints {
  const parent = rootRef.value?.parentElement;
  return {
    minw: props.minw,
    minh: props.minh,
    aspectRatio: props.aspectRatio,
    parentLimitation: props.parentLimitation,
    parentW: parent?.clientWidth ?? 0,
    parentH: parent?.clientHeight ?? 0
  };
}

const style = computed(() => ({
  left: `${box.value.x}px`,
  top: `${box.value.y}px`,
  width: `${box.value.w}px`,
  height: `${box.value.h}px`,
  zIndex: props.z
}));

let gesture: {
  px: number;
  py: number;
  box: Box;
  dir: string;
  mode: "drag" | "resize";
} | null = null;

function onPointerDown(event: PointerEvent, dir = "") {
  if (event.button !== 0) return;
  if (dir ? !props.isResizable : !props.isDraggable) return;
  if (!dir && props.dragHandle) {
    const target = event.target as HTMLElement;
    if (!target.closest(props.dragHandle)) return;
  }
  event.stopPropagation();
  gesture = {
    px: event.clientX,
    py: event.clientY,
    box: { ...box.value },
    dir,
    mode: dir ? "resize" : "drag"
  };
  emit("activated");
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
}

function onPointerMove(event: PointerEvent) {
  if (!gesture) return;
  if (event.buttons === 0) {
    onPointerUp();
    return;
  }
  const dx = event.clientX - gesture.px;
  const dy = event.clientY - gesture.py;
  if (gesture.mode === "drag") {
    box.value = dragBox(gesture.box, dx, dy, constraints());
    emit("dragging", box.value.x, box.value.y);
  } else {
    box.value = resizeBox(gesture.box, gesture.dir, dx, dy, constraints());
    emit("resizing", box.value.x, box.value.y, box.value.w, box.value.h);
  }
}

function onPointerUp() {
  if (!gesture) return;
  if (gesture.mode === "drag") {
    emit("dragstop", box.value.x, box.value.y);
  } else {
    emit("resizestop", box.value.x, box.value.y, box.value.w, box.value.h);
  }
  gesture = null;
  emit("deactivated");
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
}

onBeforeUnmount(() => {
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
});
</script>

<template>
  <div
    ref="rootRef"
    class="re-resize"
    :class="{ 'is-active': active }"
    :style="style"
    @pointerdown="onPointerDown($event)"
    @click="emit('clicked', $event)"
  >
    <div class="re-resize__content" :class="contentClass">
      <slot />
    </div>
    <template v-if="isResizable">
      <div
        v-for="stick in sticks"
        :key="stick"
        class="re-resize__stick"
        :class="`re-resize__stick--${stick}`"
        @pointerdown.stop="onPointerDown($event, stick)"
      />
    </template>
  </div>
</template>

<style lang="scss" scoped>
.re-resize {
  position: absolute;
  box-sizing: border-box;
  touch-action: none;
  border: 1px solid transparent;

  &.is-active {
    border-color: var(--el-color-primary);
  }

  &__content {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  &__stick {
    position: absolute;
    z-index: 1;
    width: 8px;
    height: 8px;
    touch-action: none;

    &--tl {
      top: -4px;
      left: -4px;
      cursor: nwse-resize;
    }

    &--tm {
      top: -4px;
      left: 50%;
      cursor: ns-resize;
      transform: translateX(-50%);
    }

    &--tr {
      top: -4px;
      right: -4px;
      cursor: nesw-resize;
    }

    &--mr {
      top: 50%;
      right: -4px;
      cursor: ew-resize;
      transform: translateY(-50%);
    }

    &--br {
      right: -4px;
      bottom: -4px;
      cursor: nwse-resize;
    }

    &--bm {
      bottom: -4px;
      left: 50%;
      cursor: ns-resize;
      transform: translateX(-50%);
    }

    &--bl {
      bottom: -4px;
      left: -4px;
      cursor: nesw-resize;
    }

    &--ml {
      top: 50%;
      left: -4px;
      cursor: ew-resize;
      transform: translateY(-50%);
    }
  }
}
</style>
