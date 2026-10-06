import { computed, ref, type Ref } from "vue";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";

/**
 * 方向键撤销点的合并键：只含窗格与动作语义段（移动/缩放），不含具体按键——
 * 连续按不同方向键属于同一次布局微调，撤销点应合并为一步（按键名会让
 * 每个方向各成一类，连按无法合并）。
 */
export function nudgeCoalesceKey(pk: string, resize: boolean): string {
  return `nudge-${pk}-${resize ? "size" : "move"}`;
}

/**
 * 大屏窗格布局的撤销 / 重做历史（增删改与拖拽手势共用一个撤销点栈）。
 *
 * - `pushHistory` 在变更**前**调用；`coalesceKey` 用于合并连续同类编辑
 *   （如逐字输入文本 / 步进器连点 / 拖拽步进）：800ms 内同 key 的变更并入
 *   上一个历史点；
 * - `resetCoalesce` 在保存成功后调用，切断跨保存的编辑合并；
 * - 恢复时布局整体替换为快照，选中窗格随快照消失时清空选中。
 */
export function usePaneHistory({
  panes,
  selectedPk,
  markDirty,
  limit = 50
}: {
  panes: Ref<ScreenLayoutPane[]>;
  selectedPk: Ref<string>;
  markDirty: () => void;
  limit?: number;
}) {
  const past = ref<ScreenLayoutPane[][]>([]);
  const future = ref<ScreenLayoutPane[][]>([]);
  let coalesceKey = "";
  let coalesceAt = 0;

  const snapshot = () => panes.value.map(pane => ({ ...pane }));

  function pushHistory(key?: string) {
    const now = Date.now();
    if (key && key === coalesceKey && now - coalesceAt < 800) {
      coalesceAt = now;
      markDirty();
      return;
    }
    coalesceKey = key ?? "";
    coalesceAt = now;
    past.value.push(snapshot());
    if (past.value.length > limit) past.value.shift();
    future.value = [];
    markDirty();
  }

  const canUndo = computed(() => past.value.length > 0);
  const canRedo = computed(() => future.value.length > 0);

  function undo() {
    const prev = past.value.pop();
    if (!prev) return;
    future.value.push(snapshot());
    panes.value = prev;
    if (!panes.value.some(pane => pane.pk === selectedPk.value)) {
      selectedPk.value = "";
    }
    markDirty();
  }

  function redo() {
    const next = future.value.pop();
    if (!next) return;
    past.value.push(snapshot());
    panes.value = next;
    markDirty();
  }

  function resetCoalesce() {
    coalesceKey = "";
  }

  return { pushHistory, canUndo, canRedo, undo, redo, resetCoalesce };
}
