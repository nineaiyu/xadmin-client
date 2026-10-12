import { computed, nextTick, shallowRef } from "vue";
import {
  useScrollLock as _useScrollLock,
  tryOnBeforeUnmount,
  tryOnMounted
} from "@vueuse/core";
import { needsScrollbar } from "@/utils/dom";
import {
  createScrollCompensator,
  getScrollLockTarget,
  SCROLL_FIXED_CLASS
} from "./scrollLockCompensation";

export { SCROLL_FIXED_CLASS };

interface ScrollLockOptions {
  /** 挂载后是否立即锁定（缺省 true，对齐 vben；仅应在弹层/锁屏类组件内使用） */
  immediate?: boolean;
}

/**
 * 带滚动条补偿的滚动锁（对齐 vben `useScrollLock`）：把锁滚动与「滚动条槽位
 * 预留 / padding 补偿」接线在一起，具体补偿实现见 `scrollLockCompensation`。
 */
export function useScrollLock(options: ScrollLockOptions = {}) {
  const { immediate = true } = options;
  const lockTarget = shallowRef<HTMLElement | null>(null);
  const isTargetLocked = _useScrollLock(lockTarget);
  const compensator = createScrollCompensator();

  const isLocked = computed({
    get: () => isTargetLocked.value,
    set: (value: boolean) => {
      const target = lockTarget.value ?? getScrollLockTarget();
      lockTarget.value = target;

      if (value) {
        if (isTargetLocked.value) return;
        if (needsScrollbar(target)) {
          compensator.apply(target);
        }
        isTargetLocked.value = true;
        return;
      }
      isTargetLocked.value = false;
      compensator.reset(target);
    }
  });

  tryOnMounted(async () => {
    const target = getScrollLockTarget();
    lockTarget.value = target;
    await nextTick();
    if (immediate && needsScrollbar(target)) {
      isLocked.value = true;
    }
  });

  tryOnBeforeUnmount(() => {
    isLocked.value = false;
  });

  return isLocked;
}
