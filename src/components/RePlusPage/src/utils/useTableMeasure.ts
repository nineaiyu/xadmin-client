import { onMounted, onUnmounted, ref, type Ref } from "vue";
import {
  DEFAULT_ADAPTIVE_OFFSET_BOTTOM,
  MIN_ADAPTIVE_TABLE_HEIGHT,
  correctHeightByOverflow,
  resolvePageOverflow
} from "./tableMeasureMath";

/**
 * 表格自适应高度与可视区宽度测量（含根节点 ResizeObserver）。
 *
 * 表格 adaptive 高度仅在挂载与窗口 resize 时测量：搜索区依赖后端字段元数据异步
 * 渲染、或用户展开/收起搜索行时，上方高度变化不会触发重测，过时的高度会把分页
 * 挤出视口造成页面级滚动条。这里观察根节点高度变化后重算高度；可视区宽度供
 * 固定操作列宽度对齐使用（见 useTableLayout）。
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

  const resolveOffsetBottom = () =>
    options?.offsetBottom?.() ?? DEFAULT_ADAPTIVE_OFFSET_BOTTOM;

  /**
   * 自适应高度的最小可用高度钳制（框架级兜底）：
   * 库内 setAdaptive 的公式为「视口高 - 表格顶 - offsetBottom」，上方内容较多
   * （如 AI 配置页的全局开关 + 调用观测卡片）且视口较矮时会算出不可用的小高度
   * （实测 33px：表体被压成 0 高、行溢出到分页之下，页面不可用）。这里在同一
   * 元素上把高度钳制到最小可用值，超出视口的部分交给页面级滚动兜底。
   * 期望高度只依赖表格顶部位置（与当前高度无关），写定后不再变化，
   * 因此不会与 ResizeObserver 形成收缩/放开的振荡循环。
   */
  let adaptiveRaf = 0;
  /** 自校正剩余轮次：溢出 → 回收 → 复测，最多两轮，避免与根 ResizeObserver 互推 */
  let correctPasses = 0;

  const applyAdaptiveTableHeight = () => {
    cancelAnimationFrame(adaptiveRaf);
    adaptiveRaf = requestAnimationFrame(() => {
      const table = rootRef.value?.querySelector<HTMLElement>(
        ".pure-table .el-table"
      );
      if (!table || !table.isConnected) return;
      const rect = table.getBoundingClientRect();
      if (!rect.height) return;
      // 1px 余量 + 按滚动容器实测溢出自校正：宁可少 1px，也不让内容区出现常驻滚动条
      const desired =
        Math.round(window.innerHeight - rect.top - resolveOffsetBottom()) - 1;
      const overflow = resolvePageOverflow(table);
      const next = correctHeightByOverflow(
        Math.max(MIN_ADAPTIVE_TABLE_HEIGHT, desired),
        overflow
      );
      if (Math.abs(rect.height - next) <= 1) {
        // 已收敛：允许下一轮重新自校正
        correctPasses = 0;
        return;
      }
      table.style.height = `${next}px`;
      // 写高后复测一轮：首次测量拿到的溢出不包含本轮写入的影响
      if (overflow > 1 && correctPasses < 2) {
        correctPasses += 1;
        applyAdaptiveTableHeight();
      } else {
        correctPasses = 0;
      }
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
