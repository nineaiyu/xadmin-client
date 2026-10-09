import { ref, watch, type Ref } from "vue";
import type { MenuRow } from "./types";

/**
 * el-tree 绑定的本地副本（自 hook.tsx 抽出）：拖拽会就地改写数据，
 * 不能把 computed 结果直接交给它。
 */
export function useRenderedTree(visibleTree: Ref<MenuRow[]>) {
  const renderedTree = ref<MenuRow[]>([]);
  watch(
    visibleTree,
    value => {
      renderedTree.value = value;
    },
    { immediate: true }
  );
  return renderedTree;
}
