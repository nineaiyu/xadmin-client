import { useEventListener } from "@vueuse/core";

/**
 * 登录子页的回车提交监听（自 useLoginFlow 抽出）：挂在 document 上的单个 keydown
 * 监听，随组件卸载自动移除。此前组件在 onMounted 手工 addEventListener 且从不移除，
 * 登录页子页切换（v-if 重建）会累积多个监听，导致一次回车触发多次提交。
 */
export function useEnterSubmit(handler: () => void) {
  useEventListener(document, "keydown", (event: KeyboardEvent) => {
    // 输入法组合态的 Enter 用于确认候选词，不是提交；弹层内的 Enter 交给弹层自身
    if (event.isComposing || event.keyCode === 229) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest?.(".el-overlay, [role='dialog']")) return;
    if (event.code === "Enter" || event.code === "NumpadEnter") {
      handler();
    }
  });
}
