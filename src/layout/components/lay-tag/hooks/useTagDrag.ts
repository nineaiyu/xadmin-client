import Sortable from "sortablejs";
import { nextTick, onBeforeUnmount, watch, type Ref } from "vue";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";

/**
 * 页签拖拽排序：拖动手柄即页签本体，松手后写回 `multiTags`（持久化开关打开时随之落库）。
 *
 * - `filter: .fixed-tag`：首页固定页签与右键「固定」的页签不可拖动；
 * - 拖到首位时把首页页签顶回首位，固定位不因拖拽漂移；
 * - 排序后调用 `refresh` 重算可视区（滚动位置与左右箭头显隐）。
 */
export function useTagDrag(options: {
  /** 页签容器（`.tab`），其子元素为 `.scroll-item` */
  tabDom: Ref<HTMLElement | undefined>;
  /** 排序完成后刷新可视区 */
  refresh: () => void;
}) {
  const { tabDom, refresh } = options;
  let sortable: Sortable | null = null;

  function destroy() {
    sortable?.destroy();
    sortable = null;
  }

  function init() {
    if (sortable || !tabDom.value) return;
    sortable = Sortable.create(tabDom.value as HTMLElement, {
      animation: 200,
      draggable: ".scroll-item",
      filter: ".fixed-tag",
      ghostClass: "tag-drag-ghost",
      // 统一走鼠标/触摸实现（而非浏览器原生 HTML5 拖放）：桌面与移动端行为一致，
      // 且原生拖放的拖影样式在各浏览器不可控（页签需要跟随指针的轻量占位效果）
      forceFallback: true,
      onEnd: ({ oldIndex, newIndex }) => {
        if (
          oldIndex === undefined ||
          newIndex === undefined ||
          oldIndex === newIndex
        ) {
          return;
        }
        const store = useMultiTagsStoreHook();
        /** 首页固定页签的路径：以排序前的首位为准（固定页签不参与拖拽） */
        const homePath = store.multiTags[0]?.path;
        const list = [...store.multiTags];
        const [moved] = list.splice(oldIndex, 1);
        list.splice(newIndex, 0, moved);
        const homeIndex = list.findIndex(tag => tag.path === homePath);
        if (homeIndex > 0) list.unshift(list.splice(homeIndex, 1)[0]);
        store.handleTags("equal", list);
        nextTick(refresh);
      }
    });
  }

  watch(
    tabDom,
    value => {
      if (value) init();
    },
    { immediate: true }
  );

  onBeforeUnmount(destroy);

  return { init, destroy };
}
