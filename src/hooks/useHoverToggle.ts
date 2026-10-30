import type { MaybeRef, Ref } from "vue";

import { computed, ref, watch } from "vue";
import { tryOnScopeDispose } from "@vueuse/core";
import {
  createHoverElementGroup,
  type HoverTarget
} from "./internal/hoverElementGroup";

interface HoverDelayOptions {
  /** 鼠标进入延迟（ms 或取值函数） */
  enterDelay?: (() => number) | number;
  /** 鼠标离开延迟（ms 或取值函数） */
  leaveDelay?: (() => number) | number;
}

export interface HoverToggleController {
  enable: () => void;
  disable: () => void;
}

const DEFAULT_ENTER_DELAY = 0;
const DEFAULT_LEAVE_DELAY = 500;

function resolveDelay(
  value: (() => number) | number | undefined,
  fallback: number
): number {
  if (value === undefined) return fallback;
  return typeof value === "function" ? value() : value;
}

/**
 * 多元素悬停延迟切换：鼠标进入任一元素即置真，
 * 全部离开后经 leaveDelay 置假——用于「悬停展开下拉、移开延迟收起」以避免
 * 鼠标从触发器移向浮层途中的闪断。返回的控制器可暂停 / 恢复监听。
 */
export function useHoverToggle(
  refElement: MaybeRef<HoverTarget | HoverTarget[]>,
  delay: (() => number) | HoverDelayOptions | number = DEFAULT_LEAVE_DELAY
): [Ref<boolean>, HoverToggleController] {
  const options: HoverDelayOptions =
    typeof delay === "number" || typeof delay === "function"
      ? { enterDelay: DEFAULT_ENTER_DELAY, leaveDelay: delay }
      : {
          enterDelay: DEFAULT_ENTER_DELAY,
          leaveDelay: DEFAULT_LEAVE_DELAY,
          ...delay
        };

  const value = ref(false);
  const group = createHoverElementGroup(refElement);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  function setValueDelay(inside: boolean) {
    clearTimer();
    const wait = inside
      ? resolveDelay(options.enterDelay, DEFAULT_ENTER_DELAY)
      : resolveDelay(options.leaveDelay, DEFAULT_LEAVE_DELAY);
    if (wait <= 0) {
      value.value = inside;
      return;
    }
    timer = setTimeout(() => {
      value.value = inside;
      timer = undefined;
    }, wait);
  }

  const isOutsideAll = computed(() =>
    group.hovers.value.every(hover => !hover.value)
  );
  const hoverWatcher = watch(isOutsideAll, outside => setValueDelay(!outside), {
    immediate: true
  });

  tryOnScopeDispose(() => {
    clearTimer();
    group.dispose();
  });

  return [
    value,
    {
      enable: () => hoverWatcher.resume(),
      disable: () => hoverWatcher.pause()
    }
  ];
}
