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
 * 每个目标的补偿状态：**模块级引用计数**。
 *
 * 多个弹层并存时各自 `apply` 一次、解除时各自 `reset` 一次；只有计数归零才恢复
 * 原始值。旧实现按实例记忆「本次是否补偿」，第二个实例会把第一个实例写入的
 * `stable` 当作原始值，全部关闭后 `scrollbar-gutter: stable` 永久残留。
 */
interface CompensatorState {
  locks: number;
  /** 非 body 目标：原始内联 scrollbar-gutter（空串表示未设置） */
  gutter: string;
  gutterApplied: boolean;
  bodyCompensated: boolean;
}

const stateMap = new WeakMap<HTMLElement, CompensatorState>();

function getState(target: HTMLElement): CompensatorState {
  let state = stateMap.get(target);
  if (!state) {
    state = {
      locks: 0,
      gutter: "",
      gutterApplied: false,
      bodyCompensated: false
    };
    stateMap.set(target, state);
  }
  return state;
}

/**
 * 滚动条补偿器：目标非 body 时写 `scrollbar-gutter: stable` 预留槽位；目标为
 * body 时按实测滚动条宽度补偿 `padding-right` 并同步固定定位节点（补偿期间关闭
 * 过渡以防抖动）。`apply` / `reset` 成对使用，内部按目标做引用计数。
 */
export function createScrollCompensator() {
  const scrollbarWidth = getScrollbarWidth();

  function apply(target: HTMLElement) {
    const state = getState(target);
    state.locks += 1;
    // 已有其它弹层上锁：保留首个实例记录的原始值，不重复写入
    if (state.locks > 1) return;
    if (!needsScrollbar(target)) return;
    if (target !== document.body) {
      state.gutter = target.style.getPropertyValue("scrollbar-gutter");
      target.style.setProperty("scrollbar-gutter", "stable");
      state.gutterApplied = true;
      return;
    }
    if (!needsScrollbar()) return;
    target.style.paddingRight = `${scrollbarWidth}px`;
    getLayoutFixedNodes().forEach(node => {
      node.dataset.transition = node.style.transition;
      node.style.transition = "none";
      node.style.paddingRight = `${scrollbarWidth}px`;
    });
    state.bodyCompensated = true;
  }

  function reset(target: HTMLElement) {
    const state = getState(target);
    if (state.locks === 0) return;
    state.locks -= 1;
    // 仍有其它弹层上锁：保持补偿
    if (state.locks > 0) return;
    if (state.bodyCompensated) {
      getLayoutFixedNodes().forEach(node => {
        node.style.paddingRight = "";
        requestAnimationFrame(() => {
          node.style.transition = node.dataset.transition || "";
        });
      });
      target.style.paddingRight = "";
      state.bodyCompensated = false;
    }
    if (state.gutterApplied) {
      if (state.gutter) {
        target.style.setProperty("scrollbar-gutter", state.gutter);
      } else {
        target.style.removeProperty("scrollbar-gutter");
      }
      state.gutter = "";
      state.gutterApplied = false;
    }
  }

  return { apply, reset };
}
