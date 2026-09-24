/**
 * 树滚动区高度测量。
 *
 * 取代旧实现的魔法值（右栏 `calc(100vh - 145px)`、左树 `calc(100vh - 200px)` 两处
 * 口径不一致导致栏底不对齐）：按「容器顶部位置 + 视口高」实测，随窗口与上方内容
 * （工具栏换行、批量条出现）变化重算。
 *
 * 期望高度只依赖滚动区顶部位置（与自身高度无关），因此不会与 ResizeObserver 振荡。
 */

import { onMounted, onUnmounted, ref, type Ref } from "vue";

const MIN_HEIGHT = 280;
const OFFSET_BOTTOM = 28;

export function useTreeHeight(
  rootRef: Ref<HTMLElement | undefined>,
  selector: string
) {
  const height = ref(420);
  let raf = 0;
  let observer: ResizeObserver | undefined;

  const measure = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const el = rootRef.value?.querySelector<HTMLElement>(selector);
      if (!el || !el.isConnected) return;
      const rect = el.getBoundingClientRect();
      if (!rect.height && !rect.top) return;
      const next = Math.max(
        MIN_HEIGHT,
        Math.round(window.innerHeight - rect.top - OFFSET_BOTTOM)
      );
      if (next !== height.value) height.value = next;
    });
  };

  onMounted(() => {
    measure();
    window.addEventListener("resize", measure);
    if (rootRef.value && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(rootRef.value);
    }
  });

  onUnmounted(() => {
    window.removeEventListener("resize", measure);
    observer?.disconnect();
    cancelAnimationFrame(raf);
  });

  return { height, measure };
}
