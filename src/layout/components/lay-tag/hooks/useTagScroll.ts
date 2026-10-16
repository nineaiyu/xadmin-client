import { nextTick, ref } from "vue";
import { isEqual, isAllEmpty } from "@pureadmin/utils";
import { computeScrollTranslate, computeTagView } from "./tagScrollMath";
import type { useTags } from "../../../hooks/useTag";

/** useTags 中滚动/视口所需的上下文切片 */
type TagScrollContext = Pick<
  ReturnType<typeof useTags>,
  "route" | "multiTags" | "instance" | "translateX" | "isScrolling"
>;

/**
 * 标签页导航的滚动与可视区域定位逻辑：几何计算见 tagScrollMath.ts（纯函数）。
 */
export function useTagScroll(ctx: TagScrollContext) {
  const { route, multiTags, instance, translateX, isScrolling } = ctx;

  const tabDom = ref();
  const scrollbarDom = ref();
  const isShowArrow = ref(false);

  const dynamicTagView = async () => {
    await nextTick();
    const index = multiTags.value.findIndex(item => {
      if (!isAllEmpty(route.query)) {
        return isEqual(route.query, item.query);
      } else if (!isAllEmpty(route.params)) {
        return isEqual(route.params, item.params);
      } else {
        return route.path === item.path;
      }
    });
    moveToView(index);
  };

  const moveToView = async (index: number): Promise<void> => {
    await nextTick();
    const refs = instance?.refs as Record<string, HTMLElement[]> | undefined;
    const tabItemEl = refs?.["dynamic" + index]?.[0];
    if (!tabItemEl) return;
    // 标签页导航栏可视长度（不含溢出部分）与已有标签总长度（含溢出部分）
    const scrollbarWidth = scrollbarDom.value
      ? scrollbarDom.value?.offsetWidth
      : 0;
    const tabWidth = tabDom.value ? tabDom.value?.offsetWidth : 0;

    const view = computeTagView({
      translateX: translateX.value,
      tabItemLeft: tabItemEl?.offsetLeft,
      tabItemWidth: tabItemEl?.offsetWidth,
      scrollbarWidth,
      tabWidth
    });
    isShowArrow.value = view.isShowArrow;
    translateX.value = view.translateX;
  };

  const handleScroll = (offset: number): void => {
    const scrollbarWidth = scrollbarDom.value
      ? scrollbarDom.value?.offsetWidth
      : 0;
    const tabWidth = tabDom.value ? tabDom.value.offsetWidth : 0;
    translateX.value = computeScrollTranslate({
      translateX: translateX.value,
      offset,
      scrollbarWidth,
      tabWidth
    });
    isScrolling.value = false;
  };

  const handleWheel = (event: WheelEvent): void => {
    isScrolling.value = true;
    const scrollIntensity = Math.abs(event.deltaX) + Math.abs(event.deltaY);
    let offset: number;
    if (event.deltaX < 0) {
      offset = scrollIntensity > 0 ? scrollIntensity : 100;
    } else {
      offset = scrollIntensity > 0 ? -scrollIntensity : -100;
    }

    smoothScroll(offset);
  };

  const smoothScroll = (offset: number): void => {
    // 每帧滚动的距离
    const scrollAmount = 20;
    let remaining = Math.abs(offset);

    const scrollStep = () => {
      const scrollOffset =
        Math.sign(offset) * Math.min(scrollAmount, remaining);
      handleScroll(scrollOffset);
      remaining -= Math.abs(scrollOffset);

      if (remaining > 0) {
        requestAnimationFrame(scrollStep);
      }
    };

    requestAnimationFrame(scrollStep);
  };

  return {
    tabDom,
    scrollbarDom,
    isShowArrow,
    dynamicTagView,
    handleScroll,
    handleWheel
  };
}
