import { onBeforeUnmount, onMounted } from "vue";

/**
 * 全局 Ctrl/Cmd+S 保存快捷键（最小公共面）。
 *
 * 报表设计器与大屏设计器共用：window keydown 随挂载注册、卸载移除；
 * 命中组合键即 preventDefault 拦截浏览器「保存网页」并回调 save。
 * 大屏侧更完整的键位（撤销/重做/方向键等）见
 * `views/analysis/screen/utils/shortcuts.ts`（内部同样消费本 composable 处理保存键）。
 *
 * `enabled` 返回 false 时不响应也不拦截（如大屏预览/只读锁定态，保持
 * 浏览器默认行为）；不传恒启用。注意：启用时不区分输入控件焦点——编辑器
 * 语义下保存永远生效，调用方自行做未保存/只读等守卫。
 */
export function useSaveShortcut(save: () => void, enabled?: () => boolean) {
  function onKeydown(event: KeyboardEvent) {
    if (enabled && !enabled()) return;
    const mod = event.ctrlKey || event.metaKey;
    if (!mod || event.key.toLowerCase() !== "s") return;
    event.preventDefault();
    save();
  }

  onMounted(() => window.addEventListener("keydown", onKeydown));
  onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
}
