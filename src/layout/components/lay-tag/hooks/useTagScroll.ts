import { nextTick, ref } from "vue";
import { isEqual, isAllEmpty } from "@pureadmin/utils";
import type { useTags } from "../../../hooks/useTag";

/** useTags 中滚动/视口所需的上下文切片 */
type TagScrollContext = Pick<
  ReturnType<typeof useTags>,
  "route" | "multiTags" | "instance" | "translateX" | "isScrolling"
>;

/** 标签页导航的滚动与可视区域定位逻辑（拆分自 lay-tag/index.vue） */
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
    const tabNavPadding = 10;
    if (!instance.refs["dynamic" + index]) return;
    const tabItemEl = instance.refs["dynamic" + index][0];
    const tabItemElOffsetLeft = (tabItemEl as HTMLElement)?.offsetLeft;
    const tabItemOffsetWidth = (tabItemEl as HTMLElement)?.offsetWidth;
    // 标签页导航栏可视长度（不包含溢出部分）
    const scrollbarDomWidth = scrollbarDom.value
      ? scrollbarDom.value?.offsetWidth
      : 0;

    // 已有标签页总长度（包含溢出部分）
    const tabDomWidth = tabDom.value ? tabDom.value?.offsetWidth : 0;

    if (scrollbarDomWidth <= tabDomWidth) {
      isShowArrow.value = true;
    } else {
      isShowArrow.value = false;
    }
    if (tabDomWidth < scrollbarDomWidth || tabItemElOffsetLeft === 0) {
      translateX.value = 0;
    } else if (tabItemElOffsetLeft < -translateX.value) {
      // 标签在可视区域左侧
      translateX.value = -tabItemElOffsetLeft + tabNavPadding;
    } else if (
      tabItemElOffsetLeft > -translateX.value &&
      tabItemElOffsetLeft + tabItemOffsetWidth <
        -translateX.value + scrollbarDomWidth
    ) {
      // 标签在可视区域
      translateX.value = Math.min(
        0,
        scrollbarDomWidth -
          tabItemOffsetWidth -
          tabItemElOffsetLeft -
          tabNavPadding
      );
    } else {
      // 标签在可视区域右侧
      translateX.value = -(
        tabItemElOffsetLeft -
        (scrollbarDomWidth - tabNavPadding - tabItemOffsetWidth)
      );
    }
  };

  const handleScroll = (offset: number): void => {
    const scrollbarDomWidth = scrollbarDom.value
      ? scrollbarDom.value?.offsetWidth
      : 0;
    const tabDomWidth = tabDom.value ? tabDom.value.offsetWidth : 0;
    if (offset > 0) {
      translateX.value = Math.min(0, translateX.value + offset);
    } else {
      if (scrollbarDomWidth < tabDomWidth) {
        if (translateX.value >= -(tabDomWidth - scrollbarDomWidth)) {
          translateX.value = Math.max(
            translateX.value + offset,
            scrollbarDomWidth - tabDomWidth
          );
        }
      } else {
        translateX.value = 0;
      }
    }
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
