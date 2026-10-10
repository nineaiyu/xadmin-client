import { onUnmounted } from "vue";
import { onKeyStroke } from "@vueuse/core";
import { useGlobal } from "@pureadmin/utils";

/**
 * 布局级快捷键（设置面板 →「通用」→「快捷键」）。
 *
 * - `Alt + L` 锁屏
 * - `Alt + S` 折叠 / 展开侧栏
 *
 * 与 vben 的默认按键口径对齐；刻意不用 Ctrl 组合：`Ctrl+L`（聚焦地址栏）与
 * `Ctrl+S`（保存页面）属浏览器保留键，页面内无法可靠拦截。
 *
 * 输入态（input / textarea / select / contenteditable）不响应，避免在表单里打字
 * 误触发；开关取自响应式存储，面板改动即时生效（与 ⌘K 全局搜索同一存储口径）。
 */
export function useLayoutShortcutKeys(handlers: {
  lock: () => void;
  toggleSidebar: () => void;
}) {
  const { $storage } = useGlobal<GlobalPropertiesApi>();

  const enabled = (key: "shortcutLock" | "shortcutSidebar") =>
    Boolean($storage?.configure?.[key] ?? true);

  /** 输入态与组合键前置过滤（返回 true 表示本次按键不处理） */
  const shouldIgnore = (event: KeyboardEvent) => {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return true;
    }
    if (event.repeat) return true;
    const target = event.target as HTMLElement | null;
    if (!target) return false;
    if (target.isContentEditable) return true;
    return ["input", "textarea", "select"].includes(
      target.tagName.toLowerCase()
    );
  };

  const stopLock = onKeyStroke(
    "l",
    (event: KeyboardEvent) => {
      if (shouldIgnore(event) || !enabled("shortcutLock")) return;
      event.preventDefault();
      handlers.lock();
    },
    { eventName: "keydown" }
  );

  const stopSidebar = onKeyStroke(
    "s",
    (event: KeyboardEvent) => {
      if (shouldIgnore(event) || !enabled("shortcutSidebar")) return;
      event.preventDefault();
      handlers.toggleSidebar();
    },
    { eventName: "keydown" }
  );

  onUnmounted(() => {
    stopLock?.();
    stopSidebar?.();
  });
}
