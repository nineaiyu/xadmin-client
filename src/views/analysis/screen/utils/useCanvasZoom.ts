import { onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";
import type { FreeDesign } from "./freeLayout";
import {
  ZOOM_STEPS,
  anchorScroll,
  clampZoom,
  fitZoom,
  stepZoom
} from "./viewport";

/**
 * 自由画布的显示缩放状态（viewport zoom）：档位切换、适应窗口、
 * `Ctrl/⌘ + 滚轮` 指针锚点缩放（换算见 `viewport.ts` 纯函数）。
 *
 * - 默认「适应窗口」：挂载、画幅变化、视口尺寸变化时自动重算；用户手动选档后停止
 *   自动跟随，点「适应窗口」恢复跟随；
 * - 普通滚轮仍交给容器滚动（只在按住 Ctrl/⌘ 时接管并 `preventDefault`）；
 * - zoom 只用于渲染与指针换算，不进入数据与保存载荷。
 */
export function useCanvasZoom({
  design,
  viewport
}: {
  design: Ref<FreeDesign>;
  viewport: Ref<HTMLElement | undefined>;
}) {
  const zoom = ref(1);
  /** 自动适应：true = 跟随视口 / 画幅变化重算 */
  const autoFit = ref(true);
  let observer: ResizeObserver | undefined;

  function fitToView() {
    const el = viewport.value;
    if (!el) return;
    autoFit.value = true;
    zoom.value = fitZoom(el.clientWidth, el.clientHeight, design.value);
  }

  /** 设置缩放（可带指针锚点：缩放前后指针下的数据点保持不动） */
  function setZoom(next: number, anchor?: { x: number; y: number }) {
    const el = viewport.value;
    const before = zoom.value;
    const target = clampZoom(next);
    if (target === before) return;
    autoFit.value = false;
    zoom.value = target;
    if (!el || !anchor) return;
    const { scrollLeft, scrollTop } = anchorScroll(before, target, {
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
      pointerX: anchor.x,
      pointerY: anchor.y
    });
    el.scrollLeft = scrollLeft;
    el.scrollTop = scrollTop;
  }

  /** 滚轮：按住 Ctrl/⌘ 才接管（指针锚点 + 档位步进），其余交给容器滚动 */
  function onWheel(event: WheelEvent) {
    if (!(event.ctrlKey || event.metaKey)) return;
    const el = viewport.value;
    if (!el) return;
    event.preventDefault();
    const rect = el.getBoundingClientRect();
    setZoom(stepZoom(zoom.value, event.deltaY > 0 ? -1 : 1), {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  }

  /** 键盘档位：上/下一档（与下拉、滚轮共用 `stepZoom`，到边界即停） */
  const zoomIn = () => setZoom(stepZoom(zoom.value, 1));
  const zoomOut = () => setZoom(stepZoom(zoom.value, -1));

  const attach = () => {
    if (!viewport.value || observer) return;
    observer = new ResizeObserver(() => {
      if (autoFit.value) fitToView();
    });
    observer.observe(viewport.value);
    fitToView();
  };

  onMounted(attach);
  // 视口元素由画布板挂载后经 defineExpose 交出：出现时补挂观察并做首次适应
  watch(viewport, attach);
  watch(design, () => {
    if (autoFit.value) fitToView();
  });
  onBeforeUnmount(() => observer?.disconnect());

  return {
    zoom,
    autoFit,
    steps: ZOOM_STEPS,
    setZoom,
    fitToView,
    onWheel,
    zoomIn,
    zoomOut
  };
}
