/**
 * DOM 相关工具：元素可见区、滚动条宽度、是否需要滚动条、布局滚动容器。
 *
 * 与 vben `packages/@core/base/shared/src/utils/dom.ts` 对齐；布局滚动容器
 * 选择器换成本项目内容区的实际节点（固定头部模式下由 el-scrollbar 承载滚动，
 * 见 `layout/components/lay-content/index.vue`）。
 */

/** 布局内容区滚动容器选择器（el-scrollbar 的滚动代理节点） */
export const LAYOUT_SCROLL_SELECTOR = ".app-main .el-scrollbar__wrap";

export interface VisibleDomRect {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}

const EMPTY_RECT: VisibleDomRect = {
  bottom: 0,
  height: 0,
  left: 0,
  right: 0,
  top: 0,
  width: 0
};

/**
 * 获取元素与视口相交的可见区域（完全不可见时返回全零矩形）。
 */
export function getElementVisibleRect(
  element?: HTMLElement | null
): VisibleDomRect {
  if (!element) {
    return EMPTY_RECT;
  }
  const rect = element.getBoundingClientRect();
  const viewHeight = Math.max(
    document.documentElement.clientHeight,
    window.innerHeight
  );
  const viewWidth = Math.max(
    document.documentElement.clientWidth,
    window.innerWidth
  );

  const top = Math.max(rect.top, 0);
  const bottom = Math.min(rect.bottom, viewHeight);
  const left = Math.max(rect.left, 0);
  const right = Math.min(rect.right, viewWidth);

  if (top >= viewHeight || bottom <= 0 || left >= viewWidth || right <= 0) {
    return EMPTY_RECT;
  }

  return {
    bottom,
    height: Math.max(0, bottom - top),
    left,
    right,
    top,
    width: Math.max(0, right - left)
  };
}

/**
 * 实测浏览器滚动条宽度（含 0，如 macOS 覆盖式滚动条）。
 */
export function getScrollbarWidth(): number {
  const scrollDiv = document.createElement("div");
  scrollDiv.style.visibility = "hidden";
  scrollDiv.style.overflow = "scroll";
  scrollDiv.style.position = "absolute";
  scrollDiv.style.top = "-9999px";
  document.body.append(scrollDiv);

  const innerDiv = document.createElement("div");
  scrollDiv.append(innerDiv);

  const scrollbarWidth = scrollDiv.offsetWidth - innerDiv.offsetWidth;

  scrollDiv.remove();
  return scrollbarWidth;
}

/** 布局内容区滚动容器（缺省为 null，调用方自行兜底到 body） */
export function getLayoutScrollElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>(LAYOUT_SCROLL_SELECTOR);
}

function elementNeedsScrollbar(element: HTMLElement): boolean {
  const overflowY = window.getComputedStyle(element).overflowY;
  if (overflowY === "hidden" || overflowY === "clip") {
    return false;
  }
  return element.scrollHeight > element.clientHeight;
}

/**
 * 判断目标（缺省为文档）当前是否需要显示滚动条。
 */
export function needsScrollbar(target?: HTMLElement | null): boolean {
  if (target) {
    return elementNeedsScrollbar(target);
  }

  const doc = document.documentElement;
  const overflowY = window.getComputedStyle(document.body).overflowY;

  if (overflowY === "scroll" || overflowY === "auto") {
    return doc.scrollHeight > window.innerHeight;
  }
  return doc.scrollHeight > window.innerHeight;
}
