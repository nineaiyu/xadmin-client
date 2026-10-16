import { onMounted, onUnmounted, ref, type Ref } from "vue";

import { createAdaptiveHeightApplier } from "./tableAdaptiveHeight";
import { DEFAULT_ADAPTIVE_OFFSET_BOTTOM } from "./tableMeasureMath";

/**
 * 表格自适应高度与可视区宽度测量（含根节点 ResizeObserver）。
 *
 * 高度校正算法在 `tableAdaptiveHeight.ts`（稳态解析解与宽度稳定窗口的取舍见该文件
 * 说明）；本 hook 只负责生命周期、根节点观察与宽度实测接线。
 */
export function useTableMeasure(
  rootRef: Ref<HTMLElement | undefined>,
  /** 底部预留（px）取值函数：缺省 110 为「列表页直铺」口径，页面经
   * pureTableProps.adaptiveConfig.offsetBottom 覆写（表格被卡片等容器包裹时
   * 下方余量更大，需按页面口径给值，否则表格会高出视口顶出页面滚动条） */
  options?: { offsetBottom?: () => number }
) {
  /** 表格可视区实测宽度（布局变化时由根 ResizeObserver 触发） */
  const tableElWidth = ref(0);

  let rootResizeObserver: ResizeObserver | undefined;

  const { apply: applyAdaptiveTableHeight, dispose: disposeApplier } =
    createAdaptiveHeightApplier({
      rootRef,
      resolveOffsetBottom: () =>
        options?.offsetBottom?.() ?? DEFAULT_ADAPTIVE_OFFSET_BOTTOM
    });

  /**
   * 表格可视区宽度实测。
   *
   * 横向滚动容器（body-wrapper）的 clientWidth 即列可视区宽度：
   * 用 el-table 宽度会多算纵向滚动条占位，边界对齐会整体偏移。
   */
  const measureTableWidth = () => {
    const scrollArea = rootRef.value?.querySelector<HTMLElement>(
      ".pure-table .el-table__body-wrapper"
    );
    const width = scrollArea?.clientWidth ?? 0;
    if (width !== tableElWidth.value) tableElWidth.value = width;
  };

  /** 建立根节点尺寸观察（auth 依赖异步数据时根元素可能晚于挂载渲染） */
  const ensureRootObserver = () => {
    if (rootResizeObserver || !rootRef.value) return;
    if (typeof ResizeObserver === "undefined") return;
    rootResizeObserver = new ResizeObserver(() => {
      applyAdaptiveTableHeight();
      measureTableWidth();
    });
    rootResizeObserver.observe(rootRef.value);
  };

  onMounted(() => {
    ensureRootObserver();
    measureTableWidth();
  });

  onUnmounted(() => {
    rootResizeObserver?.disconnect();
    disposeApplier();
  });

  return {
    tableElWidth,
    applyAdaptiveTableHeight,
    measureTableWidth,
    ensureRootObserver
  };
}
