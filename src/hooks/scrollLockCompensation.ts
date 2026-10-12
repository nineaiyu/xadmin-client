import {
  getLayoutScrollElement,
  getScrollbarWidth,
  needsScrollbar
} from "@/utils/dom";

/** 固定定位节点标记：锁 body 滚动时同步补偿其 padding-right，避免内容横向跳动。 */
export const SCROLL_FIXED_CLASS = "_scroll__fixed_";

/** 锁滚动目标：本项目为布局内容区滚动容器，缺省兜底到 body。 */
export function getScrollLockTarget(): HTMLElement {
  return getLayoutScrollElement() ?? document.body;
}

function getLayoutFixedNodes(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`.${SCROLL_FIXED_CLASS}`)];
}

/**
 * 滚动条补偿器：目标非 body 时写 `scrollbar-gutter: stable` 预留槽位；目标为
 * body 时按实测滚动条宽度补偿 `padding-right` 并同步固定定位节点（补偿期间关闭
 * 过渡以防抖动）。`apply` / `reset` 成对使用，内部记忆本次是否已补偿。
 */
export function createScrollCompensator() {
  const scrollbarWidth = getScrollbarWidth();
  let hasGutter = false;
  let hasCompensation = false;

  function apply(target: HTMLElement) {
    if (needsScrollbar(target)) {
      if (target !== document.body) {
        target.dataset.scrollbarGutter =
          target.style.getPropertyValue("scrollbar-gutter");
        target.style.setProperty("scrollbar-gutter", "stable");
        hasGutter = true;
      } else if (needsScrollbar()) {
        target.style.paddingRight = `${scrollbarWidth}px`;
        getLayoutFixedNodes().forEach(node => {
          node.dataset.transition = node.style.transition;
          node.style.transition = "none";
          node.style.paddingRight = `${scrollbarWidth}px`;
        });
        hasCompensation = true;
      }
    }
  }

  function reset(target: HTMLElement) {
    if (hasCompensation) {
      getLayoutFixedNodes().forEach(node => {
        node.style.paddingRight = "";
        requestAnimationFrame(() => {
          node.style.transition = node.dataset.transition || "";
        });
      });
      target.style.paddingRight = "";
      hasCompensation = false;
    }
    if (hasGutter) {
      const previous = target.dataset.scrollbarGutter;
      if (previous) {
        target.style.setProperty("scrollbar-gutter", previous);
      } else {
        target.style.removeProperty("scrollbar-gutter");
      }
      delete target.dataset.scrollbarGutter;
      hasGutter = false;
    }
  }

  return { apply, reset };
}
