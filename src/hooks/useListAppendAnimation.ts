import { ref, watch } from "vue";
import { appendOnlyAddedKeys } from "@/utils/listAppend";

/**
 * 列表「新增即播一次进入动画」的判定接线：传入列表项的 key getter，
 * 返回的 `isFresh` 仅对「尾部追加」场景下的新增行返回真——首次填充、
 * 整批替换（如切换会话）、前插（加载更早）与删除都不播。
 *
 * 消费方式：把 `isFresh(key)` 结果作为类名/属性传给行组件，配合
 * `style/transition.scss` 的 `.list-item-enter` 动画播放一次进入效果；
 * 与 TransitionGroup 的延迟移除不同，节点立即进出，滚动定位与 DOM
 * 宽度计量（页签拖动排序）不受影响。
 */
export function useListAppendAnimation(keys: () => string[]) {
  const fresh = ref<Set<string>>(new Set());

  watch(keys, (next, prev) => {
    fresh.value = new Set(appendOnlyAddedKeys(prev ?? [], next));
  });

  const isFresh = (key: string) => fresh.value.has(key);

  return { isFresh };
}
