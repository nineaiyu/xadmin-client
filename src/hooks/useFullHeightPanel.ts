import { onActivated, onMounted, onUnmounted, ref } from "vue";

import { BREAKPOINTS } from "@/utils/breakpoints";

/** 面板高度下限：视口过矮或多标签栏挤压时保底可用高度 */
export const PANEL_MIN_HEIGHT = 420;
/** 面板底部与视口底边的留白 */
export const PANEL_BOTTOM_GAP = 24;
/** 窄屏判定阈值（视口宽度 px）：低于此宽度左栏折叠为抽屉（= md 断点） */
export const PANEL_NARROW_BREAKPOINT = BREAKPOINTS.md;

export interface FullHeightPanelOptions {
  /** 面板高度下限，默认 {@link PANEL_MIN_HEIGHT} */
  minHeight?: number;
  /** 面板底部留白，默认 {@link PANEL_BOTTOM_GAP} */
  bottomGap?: number;
  /** 窄屏断点（视口宽度 px），默认 {@link PANEL_NARROW_BREAKPOINT} */
  narrowBreakpoint?: number;
}

/**
 * 全高面板尺寸：按视口实测替代 `calc(100vh - Npx)` 魔数，标签栏显隐、
 * 窗口尺寸变化都自适应。聊天室与 AI 控制台同一布局口径（微信式左右分栏）。
 *
 * - 挂载时首测并监听 resize（卸载自动移除）；
 * - keep-alive 二次进入不重跑 onMounted，由 onActivated 重测兜底；
 * - 窄屏（视口宽 < narrowBreakpoint）时 isNarrow 置 true，供左栏折叠为抽屉。
 *
 * 页面自有的 onMounted/onActivated/onUnmounted 逻辑与本 hook 各自独立注册，
 * 注册顺序即调用顺序（hook 先于页面正文）。
 */
export function useFullHeightPanel(options: FullHeightPanelOptions = {}) {
  const minHeight = options.minHeight ?? PANEL_MIN_HEIGHT;
  const bottomGap = options.bottomGap ?? PANEL_BOTTOM_GAP;
  const narrowBreakpoint = options.narrowBreakpoint ?? PANEL_NARROW_BREAKPOINT;

  const pageRef = ref<HTMLElement | null>(null);
  const panelHeight = ref(minHeight);
  const isNarrow = ref(false);

  function measure() {
    const el = pageRef.value;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    // 页脚与面板同处一个滚动容器（紧随其后）：不扣除会把「面板 + 页脚」顶出视口，整页出现滚动
    const footer = document.querySelector(".layout-footer");
    const footerHeight =
      footer instanceof HTMLElement ? footer.offsetHeight : 0;
    panelHeight.value = Math.max(
      Math.round(window.innerHeight - top - bottomGap - footerHeight),
      minHeight
    );
  }

  function updateViewport() {
    isNarrow.value = window.innerWidth < narrowBreakpoint;
    measure();
  }

  onMounted(() => {
    updateViewport();
    window.addEventListener("resize", updateViewport);
  });

  // keep-alive 页面二次进入不重跑 onMounted：重测面板高度
  onActivated(() => {
    measure();
  });

  onUnmounted(() => {
    window.removeEventListener("resize", updateViewport);
  });

  return { pageRef, panelHeight, panelMinHeight: minHeight, isNarrow, measure };
}
