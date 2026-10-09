import { computed, nextTick, ref, type Ref } from "vue";
import type { MenuRow } from "./types";

/**
 * 菜单树的「看得见改了什么」（自 hook.tsx 抽出）：展开集合 = 筛选展开层级
 * ∪ 保存/新增后临时展开的祖先；revealRow 展开祖先并滚动定位。
 */
export function useMenuReveal({
  filterExpandPks,
  rowIndex,
  scrollToPk
}: {
  filterExpandPks: Ref<Set<string>>;
  rowIndex: Ref<{ byPk: Map<string, MenuRow> }>;
  scrollToPk: (pk: string) => void;
}) {
  /** 保存/新增后需要临时展开的祖先（与筛选展开层级取并集） */
  const revealPks = ref<Set<string>>(new Set());
  const expandPks = computed(() => {
    const merged = new Set(filterExpandPks.value);
    revealPks.value.forEach(pk => merged.add(pk));
    return merged;
  });

  /** 展开某节点的全部祖先并滚动定位（新增/保存后「看得见改了什么」） */
  const revealRow = (pk: number | string) => {
    const next = new Set(revealPks.value);
    let cursor = rowIndex.value.byPk.get(String(pk));
    const visited = new Set<string>();
    while (cursor) {
      const key = String(cursor.pk);
      if (visited.has(key)) break;
      visited.add(key);
      next.add(key);
      cursor =
        cursor.parent === null
          ? undefined
          : rowIndex.value.byPk.get(String(cursor.parent));
    }
    revealPks.value = next;
    nextTick(() => scrollToPk(String(pk)));
  };

  return { expandPks, revealRow };
}
