import { onBeforeUnmount, onMounted, type ComputedRef, type Ref } from "vue";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import { useSaveShortcut } from "@/hooks/useSaveShortcut";

const ARROW_DELTAS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0]
};

/** 焦点在输入控件（输入框 / 文本域 / 选择器等）时不劫持按键 */
function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.isContentEditable ||
    Boolean(el.closest(".el-select, .el-input-number, .el-date-editor"))
  );
}

/**
 * 大屏设计器全局快捷键：
 * - Ctrl/Cmd+S 保存；Ctrl/Cmd+Z 撤销、Ctrl/Cmd+Shift+Z 或 Ctrl/Cmd+Y 重做；
 * - Ctrl/Cmd+D 复制选中（自由模式含多选整组）、Delete/Backspace 删除选中、Esc 取消选中；
 * - Ctrl/Cmd+C 复制到剪贴板、Ctrl/Cmd+V 粘贴、Ctrl/Cmd+A 全选（后三者仅自由模式提供）；
 * - 方向键移动选中窗格（栅格：Shift+方向 = 缩放；自由：Shift+方向 = 10px 步进）。
 * 整体锁定（预览 / 只读）时不响应；输入控件聚焦时不劫持（保存/撤销重做除外）。
 *
 * 选中相关动作用回调而非 ref 传参：自由模式是多选集合，写入语义归组合层，
 * 这里只负责「什么时候调用」。
 */
export function useScreenShortcuts(handlers: {
  /** 整体锁：预览态或只读态置 true，全部快捷键不响应 */
  locked: Ref<boolean>;
  save: () => void;
  undo: () => void;
  redo: () => void;
  duplicateSelected: () => void;
  /** 删除选中（单个 / 整组由组合层决定） */
  removeSelected: () => void;
  /** 清空选中 */
  clearSelection: () => void;
  /** 快捷键判定用：当前是否有选中的窗格（方向键 / 删除 / Esc 的门槛） */
  selected: ComputedRef<ScreenLayoutPane | undefined>;
  /** 方向键移动/缩放（delta 为步进数）；返回 false = 落点非法被驳回 */
  nudge: (
    pane: ScreenLayoutPane,
    dx: number,
    dy: number,
    shift: boolean
  ) => boolean;
  /** 以下三项仅自由模式提供（栅格模式不传 = 不响应） */
  copy?: () => void;
  paste?: () => void;
  selectAll?: () => void;
  /** zoom 键盘档位（ADR-088）：`⌘/Ctrl + = / -` 上下档、`⌘/Ctrl + 0` 适应窗口 */
  zoomIn?: () => void;
  zoomOut?: () => void;
  zoomFit?: () => void;
}) {
  // Ctrl/Cmd+S 收敛到共享 composable（与报表设计器同源）：保存键不受输入
  // 焦点限制；整体锁定（预览/只读）时不响应也不拦截，保持浏览器默认行为
  useSaveShortcut(handlers.save, () => !handlers.locked.value);

  function onKeydown(event: KeyboardEvent) {
    if (handlers.locked.value) return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (mod && key === "z") {
      event.preventDefault();
      if (event.shiftKey) handlers.redo();
      else handlers.undo();
      return;
    }
    if (mod && key === "y") {
      event.preventDefault();
      handlers.redo();
      return;
    }
    if (isTypingTarget(event.target)) return;
    if (mod && key === "d") {
      event.preventDefault();
      handlers.duplicateSelected();
      return;
    }
    if (mod && key === "c" && handlers.copy) {
      event.preventDefault();
      handlers.copy();
      return;
    }
    if (mod && key === "v" && handlers.paste) {
      event.preventDefault();
      handlers.paste();
      return;
    }
    if (mod && key === "a" && handlers.selectAll) {
      event.preventDefault();
      handlers.selectAll();
      return;
    }
    // zoom 档位：浏览器/系统默认（放大、缩小、重置）一律拦下，三键共用同一份档位表
    if (mod && (event.key === "=" || event.key === "+")) {
      if (!handlers.zoomIn) return;
      event.preventDefault();
      handlers.zoomIn();
      return;
    }
    if (mod && (event.key === "-" || event.key === "_")) {
      if (!handlers.zoomOut) return;
      event.preventDefault();
      handlers.zoomOut();
      return;
    }
    if (mod && event.key === "0") {
      if (!handlers.zoomFit) return;
      event.preventDefault();
      handlers.zoomFit();
      return;
    }
    if (event.key === "Escape") {
      handlers.clearSelection();
      return;
    }
    if (!handlers.selected.value) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      handlers.removeSelected();
      return;
    }
    const delta = ARROW_DELTAS[event.key];
    if (!delta) return;
    event.preventDefault();
    handlers.nudge(handlers.selected.value, delta[0], delta[1], event.shiftKey);
  }

  onMounted(() => window.addEventListener("keydown", onKeydown));
  onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
}
