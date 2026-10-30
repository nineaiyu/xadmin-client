import type { Ref } from "vue";

import type { DashboardCard } from "@/api/dataset/datasets";
import { useSortable } from "@/hooks/useSortable";

/** 卡片上下移一位（编辑态键盘/按钮排序；越界返回原数组） */
export function moveCardInList<T extends { id: string }>(
  list: T[],
  id: string,
  offset: number
): T[] {
  const index = list.findIndex(card => card.id === id);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** 拖拽落点重排：把 oldIndex 卡片移动到 newIndex（编辑态草稿排序写回） */
export function moveCardTo<T>(
  list: T[],
  oldIndex: number,
  newIndex: number
): T[] {
  const next = [...list];
  const [moved] = next.splice(oldIndex, 1);
  next.splice(newIndex, 0, moved);
  return next;
}

/**
 * 草稿拖拽排序接线：手柄 `drag-handle` 仅编辑态渲染，拖动结果写回草稿。
 * 拖拽手势由 useSortable 统一承载（sortablejs 按需加载），此处只保留数据重排。
 */
export function createDraftSortable(
  draft: Ref<DashboardCard[]>,
  rowEl: () => HTMLElement | undefined
) {
  return useSortable(rowEl, {
    animation: 200,
    handle: ".drag-handle",
    onEnd: ({ oldIndex, newIndex }) => {
      if (
        oldIndex === undefined ||
        newIndex === undefined ||
        oldIndex === newIndex
      )
        return;
      draft.value = moveCardTo(draft.value, oldIndex, newIndex);
    }
  });
}
