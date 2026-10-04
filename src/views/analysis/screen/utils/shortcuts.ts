import { onBeforeUnmount, onMounted, type ComputedRef, type Ref } from "vue";
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

/**
 * 大屏设计器全局快捷键：
 * - Ctrl/Cmd+S 保存；Ctrl/Cmd+Z 撤销、Ctrl/Cmd+Shift+Z 或 Ctrl/Cmd+Y 重做；
 * - Ctrl/Cmd+D 复制选中、Delete/Backspace 删除选中、Esc 取消选中；
 * - 方向键移动选中窗格（Shift+方向 = 缩放）。
 * 预览态整体忽略；输入控件聚焦时不劫持（保存/撤销重做除外）。
 */
export function useScreenShortcuts(handlers: {
  preview: Ref<boolean>;
  save: () => void;
  undo: () => void;
  redo: () => void;
  duplicateSelected: () => void;
  removePane: (pk: string) => void;
  selected: ComputedRef<ScreenLayoutPane | undefined>;
  selectedPk: Ref<string>;
  /** 方向键移动/缩放（delta 为格数增量）；返回 false = 落点非法被驳回 */
  nudge: (
    pane: ScreenLayoutPane,
    key: string,
    dx: number,
    dy: number,
    shift: boolean
  ) => boolean;
}) {
  function onKeydown(event: KeyboardEvent) {
    if (handlers.preview.value) return;
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === "s") {
      event.preventDefault();
      handlers.save();
      return;
    }
    if (mod && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) handlers.redo();
      else handlers.undo();
      return;
    }
    if (mod && event.key.toLowerCase() === "y") {
      event.preventDefault();
      handlers.redo();
      return;
    }
    if (isTypingTarget(event.target)) return;
    if (mod && event.key.toLowerCase() === "d") {
      event.preventDefault();
      handlers.duplicateSelected();
      return;
    }
    if (!handlers.selected.value) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      handlers.removePane(handlers.selectedPk.value);
      return;
    }
    if (event.key === "Escape") {
      handlers.selectedPk.value = "";
      return;
    }
    const delta = ARROW_DELTAS[event.key];
    if (!delta) return;
    event.preventDefault();
    handlers.nudge(
      handlers.selected.value,
      event.key,
      delta[0],
      delta[1],
      event.shiftKey
    );
  }

  onMounted(() => window.addEventListener("keydown", onKeydown));
  onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
}
