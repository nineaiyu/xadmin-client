<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";

import { dragBox, resizeBox, type Box, type BoxConstraints } from "./geometry";

defineOptions({ name: "ReResize" });

/**
 * 绝对定位的可拖拽 / 可缩放盒子：拖动移动、八向手柄缩放，可选等比与父容器约束。
 * 交互走 Pointer 事件（鼠标 / 触屏统一）；几何计算抽为纯函数（`geometry.ts`）以便单测。
 *
 * 何时用：需要「自由像素定位」的元素编辑（任意摆放 + 八向拉伸）。大屏自由画布
 * （`views/analysis/screen/`）即本组件的业务落点：整块可拖 + 八向缩放 + 父容器约束 +
 * `snap` 吸附钩子（对齐参考线算法留在业务侧纯函数里，组件只做手势与几何）。
 * 何时不用：栅格语义的画布——栅格画布走栅格步进 + 重叠保护 + 撤销合并
 * （`views/analysis/screen/utils/canvasDrag.ts`），强接会丢失吸附与碰撞检测。
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
    /** 激活态（高亮描边 + 手柄可见） */
    active?: boolean;
    /** 内容区类名 */
    contentClass?: string;
    /**
     * 显示缩放因子（默认 1）：调用方对宿主做了 CSS `transform: scale` 时必须传入，
     * 否则指针位移会被浏览器按缩放后的坐标系给出、与本地盒模型不一致（拖动手感漂移）。
     * 组件只做「指针增量 ÷ scale」的换算，盒模型与约束始终是本地 px。
     */
    scale?: number;
    /**
     * 吸附钩子（可选）：手势中把候选盒模型与方向（空串 = 拖动，否则为缩放手柄方位）
     * 交给调用方，返回吸附后的盒模型与命中信息（组件原样经 `snapping` 事件回传）。
     * 业务吸附规则不进组件，保证组件通用性。
     */
    snap?: (_box: Box, _dir: string) => { box: Box; guides?: unknown[] } | null;
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
    contentClass: "",
    scale: 1,
    snap: undefined
  }
);

const emit = defineEmits<{
  clicked: [event: MouseEvent];
  dragging: [x: number, y: number];
  dragstop: [x: number, y: number];
  resizing: [x: number, y: number, w: number, h: number];
  resizestop: [x: number, y: number, w: number, h: number];
  /** 吸附命中信息（`snap` 钩子返回值透传，无命中时为空数组） */
  snapping: [guides: unknown[]];
  activated: [];
  deactivated: [];
}>();

const box = ref<Box>({ x: props.x, y: props.y, w: props.w, h: props.h });
const rootRef = ref<HTMLElement>();

let gesture: {
  px: number;
  py: number;
  box: Box;
  dir: string;
  mode: "drag" | "resize";
} | null = null;

/**
 * props ↔ box 同步：外部变更（属性面板改数值 / 撤销回放 / 手势落数据后回写）时
 * 回写内部盒模型。手势进行中忽略「同值回显」（手势自身的值不需要再同步），
 * 外部改写为不同值时仍然生效。
 */
watch(
  () => [props.x, props.y, props.w, props.h] as const,
  ([x, y, w, h]) => {
    if (
      gesture &&
      x === box.value.x &&
      y === box.value.y &&
      w === box.value.w &&
      h === box.value.h
    ) {
      return;
    }
    box.value = { x, y, w, h };
  }
);

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
  zIndex: props.z,
  // 手柄「屏幕尺寸恒定」：外层可能整体 `transform: scale(z)`（自由画布缩放编辑），
  // 手柄按 1/z 反缩放，避免缩小后命中区只剩几像素（见 styles 里的 --stick-size）
  "--re-resize-inv": String(1 / (props.scale > 0 ? props.scale : 1))
}));

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

/** 交 `snap` 钩子吸附（命中信息经 `snapping` 回传给调用方绘制参考线） */
function applySnap(next: Box, dir: string): Box {
  const result = props.snap?.(next, dir);
  if (!result) return next;
  emit("snapping", result.guides ?? []);
  return result.box;
}

function onPointerMove(event: PointerEvent) {
  if (!gesture) return;
  if (event.buttons === 0) {
    onPointerUp();
    return;
  }
  // 宿主被 CSS 缩放时，指针位移是屏幕像素：除以 scale 才回到本地盒模型坐标系
  const scale = props.scale > 0 ? props.scale : 1;
  const dx = (event.clientX - gesture.px) / scale;
  const dy = (event.clientY - gesture.py) / scale;
  if (gesture.mode === "drag") {
    box.value = applySnap(dragBox(gesture.box, dx, dy, constraints()), "");
    emit("dragging", box.value.x, box.value.y);
  } else {
    box.value = applySnap(
      resizeBox(gesture.box, gesture.dir, dx, dy, constraints()),
      gesture.dir
    );
    emit("resizing", box.value.x, box.value.y, box.value.w, box.value.h);
  }
}

function onPointerUp() {
  if (!gesture) return;
  // 先结束手势再抛事件：调用方在 stop 事件里回写 props 不会撞上「手势进行中」判定
  const finished = gesture;
  gesture = null;
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  if (finished.mode === "drag") {
    emit("dragstop", box.value.x, box.value.y);
  } else {
    emit("resizestop", box.value.x, box.value.y, box.value.w, box.value.h);
  }
  emit("deactivated");
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
    /* 屏幕尺寸恒定：8px 基准 × 外层的 1/z（scale 为 1 时就是 8px）；
       偏移用同一变量派生，保证手柄始终骑在窗格角 / 边上 */
    --stick-size: calc(8px * var(--re-resize-inv, 1));

    position: absolute;
    z-index: 1;
    width: var(--stick-size);
    height: var(--stick-size);
    touch-action: none;

    /* 激活态才可见：未选中的元素不铺满手柄（避免视觉噪音），命中区域始终存在 */
    .is-active & {
      background: var(--el-color-primary);
      border-radius: 2px;
    }

    &--tl {
      top: calc(var(--stick-size) / -2);
      left: calc(var(--stick-size) / -2);
      cursor: nwse-resize;
    }

    &--tm {
      top: calc(var(--stick-size) / -2);
      left: 50%;
      cursor: ns-resize;
      transform: translateX(-50%);
    }

    &--tr {
      top: calc(var(--stick-size) / -2);
      right: calc(var(--stick-size) / -2);
      cursor: nesw-resize;
    }

    &--mr {
      top: 50%;
      right: calc(var(--stick-size) / -2);
      cursor: ew-resize;
      transform: translateY(-50%);
    }

    &--br {
      right: calc(var(--stick-size) / -2);
      bottom: calc(var(--stick-size) / -2);
      cursor: nwse-resize;
    }

    &--bm {
      bottom: calc(var(--stick-size) / -2);
      left: 50%;
      cursor: ns-resize;
      transform: translateX(-50%);
    }

    &--bl {
      bottom: calc(var(--stick-size) / -2);
      left: calc(var(--stick-size) / -2);
      cursor: nesw-resize;
    }

    &--ml {
      top: 50%;
      left: calc(var(--stick-size) / -2);
      cursor: ew-resize;
      transform: translateY(-50%);
    }
  }
}
</style>
