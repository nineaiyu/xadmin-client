import { copyText } from "@/utils/clipboard";
import { useEventListener } from "@vueuse/core";
import type { Directive, DirectiveBinding } from "vue";

export interface CopyEl extends HTMLElement {
  copyValue: string;
}

/** 文本复制指令（默认双击复制，`v-copy:click` 切换单击；提示口径走剪贴板统一出口） */
export const copy: Directive = {
  mounted(el: CopyEl, binding: DirectiveBinding<string>) {
    el.copyValue = binding.value ?? "";
    const arg = binding.arg ?? "dblclick";
    // 监听始终注册：值后到时仍可复制（旧实现初值为空则永久失效）
    useEventListener(el, arg, () => {
      if (el.copyValue) void copyText(el.copyValue);
    });
  },
  updated(el: CopyEl, binding: DirectiveBinding) {
    el.copyValue = binding.value ?? "";
  }
};
