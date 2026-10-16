import { copyText } from "@/utils/clipboard";
import { useEventListener } from "@vueuse/core";
import type { Directive, DirectiveBinding } from "vue";

export interface CopyEl extends HTMLElement {
  copyValue: string;
}

/** 文本复制指令（默认双击复制，`v-copy:click` 切换单击；提示口径走剪贴板统一出口） */
export const copy: Directive = {
  mounted(el: CopyEl, binding: DirectiveBinding<string>) {
    const { value } = binding;
    if (value) {
      el.copyValue = value;
      const arg = binding.arg ?? "dblclick";
      // Register using addEventListener on mounted, and removeEventListener automatically on unmounted
      useEventListener(el, arg, () => {
        void copyText(el.copyValue);
      });
    }
  },
  updated(el: CopyEl, binding: DirectiveBinding) {
    el.copyValue = binding.value;
  }
};
