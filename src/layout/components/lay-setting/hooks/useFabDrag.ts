import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  type CSSProperties
} from "vue";

import {
  clampFabPosition,
  readFabPosition,
  writeFabPosition,
  type FabPosition
} from "../utils/fabPosition";

/**
 * 悬浮球拖拽（右下角设置入口）：按住可拖到视口任意位置，位置存本地偏好
 * （见 `utils/fabPosition`），窗口尺寸变化时把人拖出视口的历史位置拉回来。
 *
 * 点击与拖拽共用同一套指针事件，按位移阈值区分（在 pointerup 上收口，
 * 不依赖浏览器随后派发的 click——拖到视口边缘被钳制时指针会滑出球体，
 * 那次 click 落不到球上，用 click 判定会「松手即弹面板」或吞掉下一次点击）：
 * - 位移 < 4px 视为点击 → 打开设置面板；
 * - 位移 ≥ 4px 视为拖拽 → 落库位置，不打开面板。
 * 键盘 Enter / Space 走同一入口，不受拖拽影响。
 */
const DRAG_THRESHOLD = 4;

export function useFabDrag(onActivate: () => void) {
  const position = ref<FabPosition | null>(readFabPosition());
  const dragging = ref(false);

  let pointerId: number | null = null;
  /** 按下时的指针坐标与球体左上角坐标，拖拽中据此算增量 */
  let origin = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  let moved = false;

  const style = computed<CSSProperties>(() => {
    const value = position.value;
    if (!value) return {};
    // 有记录时以 left/top 绝对定位，必须清掉默认的 right/bottom
    return {
      left: `${value.x}px`,
      top: `${value.y}px`,
      right: "auto",
      bottom: "auto"
    };
  });

  const viewport = () => ({
    width: window.innerWidth,
    height: window.innerHeight
  });

  function onPointerMove(event: PointerEvent) {
    if (pointerId === null || event.pointerId !== pointerId) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    moved = true;
    position.value = clampFabPosition(
      { x: start.x + dx, y: start.y + dy },
      viewport()
    );
  }

  function detach() {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
    document.body.style.userSelect = "";
  }

  function onPointerUp(event: PointerEvent) {
    if (pointerId === null || event.pointerId !== pointerId) return;
    const wasMoved = moved;
    detach();
    pointerId = null;
    dragging.value = false;
    if (wasMoved) {
      writeFabPosition(position.value);
      return;
    }
    // 位移未过阈值 = 点击：在抬起时打开面板
    onActivate();
  }

  /** 指针被系统取消（来电、手势接管等）：只收尾，不视为点击 */
  function onPointerCancel(event: PointerEvent) {
    if (pointerId === null || event.pointerId !== pointerId) return;
    detach();
    pointerId = null;
    dragging.value = false;
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    pointerId = event.pointerId;
    origin = { x: event.clientX, y: event.clientY };
    start = { x: rect.left, y: rect.top };
    moved = false;
    dragging.value = true;
    // 拖拽期间禁止选中文本（快速横向拖动会拖蓝整页文字）
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
  }

  /** 视口变化后把球拉回可见区域（横竖屏切换 / 浏览器窗口缩放） */
  function reclamp() {
    if (!position.value) return;
    position.value = clampFabPosition(position.value, viewport());
  }

  onMounted(() => {
    reclamp();
    window.addEventListener("resize", reclamp);
  });

  onBeforeUnmount(() => {
    detach();
    window.removeEventListener("resize", reclamp);
  });

  return {
    /** 已保存的绝对位置（null = 默认右下角） */
    position,
    dragging,
    /** 绑定到球体的内联样式 */
    style,
    onPointerDown,
    /** 键盘触发（Enter / Space）与点击同一入口 */
    onActivate
  };
}
