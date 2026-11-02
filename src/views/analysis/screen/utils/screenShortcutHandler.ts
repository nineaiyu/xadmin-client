import type { ComputedRef, Ref } from "vue";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";

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

/** 大屏设计器快捷键的回调集合（判定与调用时机在 dispatcher 内统一） */
export interface ScreenShortcutHandlers {
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
  /** zoom 键盘档位：`⌘/Ctrl + = / -` 上下档、`⌘/Ctrl + 0` 适应窗口 */
  zoomIn?: () => void;
  zoomOut?: () => void;
  zoomFit?: () => void;
}

/**
 * 快捷键分发（自 useScreenShortcuts 抽出，行数门禁）：
 * - Ctrl/Cmd+S 保存由 `useSaveShortcut` 单独处理（不受输入焦点限制）；
 * - 撤销/重做、复制/粘贴/全选、删除/Esc、方向键移动在此统一判定；
 * - 整体锁定（预览 / 只读）时不响应；输入控件聚焦时不劫持（撤销/重做交还浏览器）。
 */
export function createShortcutDispatcher(handlers: ScreenShortcutHandlers) {
  return function onKeydown(event: KeyboardEvent) {
    if (handlers.locked.value) return;
    // 输入控件内的撤销/重做属于文本编辑，不能劫持为画布撤销
    if (isTypingTarget(event.target)) return;
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
  };
}
