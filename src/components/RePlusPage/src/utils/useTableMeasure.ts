import { onMounted, onUnmounted, ref, type Ref } from "vue";

/**
 * 表格自适应高度与可视区宽度测量（含根节点 ResizeObserver）。
 *
 * 表格 adaptive 高度仅在挂载与窗口 resize 时测量：搜索区依赖后端字段元数据异步
 * 渲染、或用户展开/收起搜索行时，上方高度变化不会触发重测，过时的高度会把分页
 * 挤出视口造成页面级滚动条。这里观察根节点高度变化后重算高度；可视区宽度供
 * 固定操作列宽度对齐使用（见 useTableLayout）。
 */
export function useTableMeasure(rootRef: Ref<HTMLElement | undefined>) {
  /** 表格可视区实测宽度（布局变化时由根 ResizeObserver 触发） */
  const tableElWidth = ref(0);

  let rootResizeObserver: ResizeObserver | undefined;

  /**
   * 自适应高度的最小可用高度钳制（框架级兜底）：
   * 库内 setAdaptive 的公式为「视口高 - 表格顶 - offsetBottom」，上方内容较多
   * （如 AI 配置页的全局开关 + 调用观测卡片）且视口较矮时会算出不可用的小高度
   * （实测 33px：表体被压成 0 高、行溢出到分页之下，页面不可用）。这里在同一
   * 元素上把高度钳制到最小可用值，超出视口的部分交给页面级滚动兜底。
   * 期望高度只依赖表格顶部位置（与当前高度无关），写定后不再变化，
   * 因此不会与 ResizeObserver 形成收缩/放开的振荡循环。
   */
  const ADAPTIVE_OFFSET_BOTTOM = 110;
  const MIN_ADAPTIVE_TABLE_HEIGHT = 260;
  let adaptiveRaf = 0;

  const applyAdaptiveTableHeight = () => {
    cancelAnimationFrame(adaptiveRaf);
    adaptiveRaf = requestAnimationFrame(() => {
      const table = rootRef.value?.querySelector<HTMLElement>(
        ".pure-table .el-table"
      );
      if (!table || !table.isConnected) return;
      const rect = table.getBoundingClientRect();
      if (!rect.height) return;
      const desired = Math.round(
        window.innerHeight - rect.top - ADAPTIVE_OFFSET_BOTTOM
      );
      const next = Math.max(MIN_ADAPTIVE_TABLE_HEIGHT, desired);
      if (Math.abs(rect.height - next) <= 1) return;
      table.style.height = `${next}px`;
    });
  };

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
    cancelAnimationFrame(adaptiveRaf);
  });

  return {
    tableElWidth,
    applyAdaptiveTableHeight,
    measureTableWidth,
    ensureRootObserver
  };
}
