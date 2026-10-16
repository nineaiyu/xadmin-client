import { useEventListener } from "@vueuse/core";
import type { Directive, DirectiveBinding } from "vue";
import { isFunction, subAfter, subBefore } from "@pureadmin/utils";

export const longpress: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    const cb = binding.value;
    if (cb && isFunction(cb)) {
      let timer: ReturnType<typeof setTimeout> | null = null;
      let interTimer: ReturnType<typeof setInterval> | null = null;
      let num = 500;
      let interNum: number | null = null;
      const isInter = binding?.arg?.includes(":") ?? false;

      if (isInter) {
        num = Number(subBefore(binding.arg, ":"));
        interNum = Number(subAfter(binding.arg, ":"));
      } else if (binding.arg) {
        num = Number(binding.arg);
      }

      const clear = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (interTimer) {
          clearInterval(interTimer);
          interTimer = null;
        }
      };

      const onDownInter = (ev: PointerEvent) => {
        ev.preventDefault();
        if (interTimer === null) {
          // interNum 仅在 isInter 分支赋值（onDownInter 也只在该路径触发），此处按 number 收窄
          interTimer = setInterval(() => cb(), interNum as number);
        }
      };

      const onDown = (ev: PointerEvent) => {
        clear();
        ev.preventDefault();
        if (timer === null) {
          timer = isInter
            ? setTimeout(() => {
                cb();
                onDownInter(ev);
              }, num)
            : setTimeout(() => cb(), num);
        }
      };

      // Register using addEventListener on mounted, and removeEventListener automatically on unmounted
      useEventListener(el, "pointerdown", onDown);
      useEventListener(el, "pointerup", clear);
      useEventListener(el, "pointerleave", clear);
    } else {
      throw new Error(
        '[Directive: longpress]: need callback and callback must be a function! Like v-longpress="callback"'
      );
    }
  }
};
