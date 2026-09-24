import { message } from "@/utils/message";
import { transformI18n } from "@/plugins/i18n";
import { useEventListener } from "@vueuse/core";
import { copyTextToClipboard } from "@pureadmin/utils";
import type { Directive, DirectiveBinding } from "vue";

export interface CopyEl extends HTMLElement {
  copyValue: string;
}

/** 文本复制指令（默认双击复制） */
export const copy: Directive = {
  mounted(el: CopyEl, binding: DirectiveBinding<string>) {
    const { value } = binding;
    if (value) {
      el.copyValue = value;
      const arg = binding.arg ?? "dblclick";
      // Register using addEventListener on mounted, and removeEventListener automatically on unmounted
      useEventListener(el, arg, () => {
        if (copyTextToClipboard(el.copyValue)) {
          message(transformI18n("results.copySuccess"), { type: "success" });
        } else {
          message(transformI18n("results.copyFailed"), { type: "error" });
        }
      });
    } else {
      // throw new Error(
      //   '[Directive: copy]: need value! Like v-copy="modelValue"'
      // );
    }
  },
  updated(el: CopyEl, binding: DirectiveBinding) {
    el.copyValue = binding.value;
  }
};
