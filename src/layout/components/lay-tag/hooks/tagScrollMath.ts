/** 标签页导航左右内边距（与滚动定位计算共用） */
export const TAB_NAV_PADDING = 10;

/**
 * 标签视图定位几何（自 useTagScroll.ts 抽出，纯函数便于单测）：
 * 按激活标签相对可视区的位置（左/内/右）算出 translateX 与箭头显隐。
 */
export function computeTagView({
  translateX,
  tabItemLeft,
  tabItemWidth,
  scrollbarWidth,
  tabWidth
}: {
  translateX: number;
  tabItemLeft: number;
  tabItemWidth: number;
  /** 标签页导航栏可视长度（不包含溢出部分） */
  scrollbarWidth: number;
  /** 已有标签页总长度（包含溢出部分） */
  tabWidth: number;
}): { translateX: number; isShowArrow: boolean } {
  const isShowArrow = scrollbarWidth <= tabWidth;
  if (tabWidth < scrollbarWidth || tabItemLeft === 0) {
    return { translateX: 0, isShowArrow };
  }
  if (tabItemLeft < -translateX) {
    // 标签在可视区域左侧
    return { translateX: -tabItemLeft + TAB_NAV_PADDING, isShowArrow };
  }
  if (
    tabItemLeft > -translateX &&
    tabItemLeft + tabItemWidth < -translateX + scrollbarWidth
  ) {
    // 标签在可视区域
    return {
      translateX: Math.min(
        0,
        scrollbarWidth - tabItemWidth - tabItemLeft - TAB_NAV_PADDING
      ),
      isShowArrow
    };
  }
  // 标签在可视区域右侧
  return {
    translateX: -(
      tabItemLeft -
      (scrollbarWidth - TAB_NAV_PADDING - tabItemWidth)
    ),
    isShowArrow
  };
}

/** 滚轮/箭头滚动后的 translateX（自 useTagScroll.ts 抽出，纯函数便于单测） */
export function computeScrollTranslate({
  translateX,
  offset,
  scrollbarWidth,
  tabWidth
}: {
  translateX: number;
  offset: number;
  scrollbarWidth: number;
  tabWidth: number;
}): number {
  if (offset > 0) {
    return Math.min(0, translateX + offset);
  }
  if (scrollbarWidth < tabWidth) {
    if (translateX >= -(tabWidth - scrollbarWidth)) {
      return Math.max(translateX + offset, scrollbarWidth - tabWidth);
    }
    return translateX;
  }
  return 0;
}
