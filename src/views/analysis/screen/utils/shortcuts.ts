import { onBeforeUnmount, onMounted } from "vue";
import { useSaveShortcut } from "@/hooks/useSaveShortcut";
import {
  createShortcutDispatcher,
  type ScreenShortcutHandlers
} from "./screenShortcutHandler";

/**
 * 大屏设计器全局快捷键：
 * - Ctrl/Cmd+S 保存；Ctrl/Cmd+Z 撤销、Ctrl/Cmd+Shift+Z 或 Ctrl/Cmd+Y 重做；
 * - Ctrl/Cmd+D 复制选中（自由模式含多选整组）、Delete/Backspace 删除选中、Esc 取消选中；
 * - Ctrl/Cmd+C 复制到剪贴板、Ctrl/Cmd+V 粘贴、Ctrl/Cmd+A 全选（后三者仅自由模式提供）；
 * - 方向键移动选中窗格（栅格：Shift+方向 = 缩放；自由：Shift+方向 = 10px 步进）。
 * 整体锁定（预览 / 只读）时不响应；输入控件聚焦时不劫持（保存键除外，
 * 撤销/重做交还浏览器原生文本撤销）。
 *
 * 选中相关动作用回调而非 ref 传参：自由模式是多选集合，写入语义归组合层，
 * 这里只负责「什么时候调用」。
 */
export function useScreenShortcuts(handlers: ScreenShortcutHandlers) {
  // Ctrl/Cmd+S 收敛到共享 composable（与报表设计器同源）：保存键不受输入
  // 焦点限制；整体锁定（预览/只读）时不响应也不拦截，保持浏览器默认行为
  useSaveShortcut(handlers.save, () => !handlers.locked.value);

  const onKeydown = createShortcutDispatcher(handlers);

  onMounted(() => window.addEventListener("keydown", onKeydown));
  onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
}
