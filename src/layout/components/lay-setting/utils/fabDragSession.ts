import { clampFabPosition, type FabPosition } from "./fabPosition";

/**
 * 悬浮球拖拽的指针会话（`useFabDrag` 的实现域）。
 *
 * 从 hook 里抽出成普通模块的原因有两个：hook 只保留「状态 + 生命周期」接线，
 * 指针事件编排（按下 / 移动 / 抬起 / 取消与监听解绑）可以脱离 Vue 独立阅读；
 * 同时避免 hook 文件继续变长（hook 超长门禁 ≥120 行）。
 *
 * 点击与拖拽共用同一套指针事件，按位移阈值区分，且在 pointerup 上收口
 * （不依赖浏览器随后派发的 click——拖到视口边缘被钳制时指针会滑出球体，
 * 那次 click 落不到球上，用 click 判定会「松手即弹面板」或吞掉下一次点击）。
 */

/** 位移 < 该值视为点击，≥ 视为拖拽 */
export const DRAG_THRESHOLD = 4;

export interface FabDragCallbacks {
  /** 拖拽中位置变化（每帧回调，已按视口钳制） */
  onMove: (position: FabPosition) => void;
  /** 松手且确认为拖拽：落库最终位置 */
  onDrop: (position: FabPosition) => void;
  /** 松手且位移未过阈值：视为点击 */
  onActivate: () => void;
  /** 拖拽态变化（供调用方切换样式 / 状态） */
  onDragStateChange: (dragging: boolean) => void;
}

export interface FabDragSession {
  /** 绑定到球体的 pointerdown */
  onPointerDown: (event: PointerEvent) => void;
  /** 解绑全部窗口监听（组件卸载或会话中断时调用） */
  detach: () => void;
  /** 把位置钳制回当前视口（视口尺寸变化后调用） */
  clamp: (position: FabPosition) => FabPosition;
}

export function createFabDragSession(
  callbacks: FabDragCallbacks
): FabDragSession {
  let pointerId: number | null = null;
  /** 按下时的指针坐标与球体左上角坐标，拖拽中据此算增量 */
  let origin = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  let moved = false;
  /** 最近一次有效拖拽位置（落库用；取消时不使用） */
  let last: FabPosition | null = null;

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
    last = clampFabPosition({ x: start.x + dx, y: start.y + dy }, viewport());
    callbacks.onMove(last);
  }

  function detach() {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
    document.body.style.userSelect = "";
  }

  function onPointerUp(event: PointerEvent) {
    if (pointerId === null || event.pointerId !== pointerId) return;
    const dropped = moved ? last : null;
    detach();
    pointerId = null;
    callbacks.onDragStateChange(false);
    if (dropped) {
      callbacks.onDrop(dropped);
      return;
    }
    // 位移未过阈值 = 点击：在抬起时打开面板
    callbacks.onActivate();
  }

  /** 指针被系统取消（来电、手势接管等）：只收尾，既不落库也不视为点击 */
  function onPointerCancel(event: PointerEvent) {
    if (pointerId === null || event.pointerId !== pointerId) return;
    detach();
    pointerId = null;
    last = null;
    callbacks.onDragStateChange(false);
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    pointerId = event.pointerId;
    origin = { x: event.clientX, y: event.clientY };
    start = { x: rect.left, y: rect.top };
    moved = false;
    last = null;
    callbacks.onDragStateChange(true);
    // 拖拽期间禁止选中文本（快速横向拖动会拖蓝整页文字）
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
  }

  return {
    onPointerDown,
    detach,
    clamp: position => clampFabPosition(position, viewport())
  };
}
