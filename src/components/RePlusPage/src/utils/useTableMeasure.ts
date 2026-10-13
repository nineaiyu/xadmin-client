import { onMounted, onUnmounted, ref, type Ref } from "vue";
import {
  DEFAULT_ADAPTIVE_OFFSET_BOTTOM,
  resolveAdaptiveHeight,
  resolvePageOverflow
} from "./tableMeasureMath";

/** 宽度变化后的稳定窗口（ms）：期间的宽度变化视为拖动，统一推迟到最后一次变化之后重算 */
const WIDTH_SETTLE_MS = 200;

/**
 * 表格自适应高度与可视区宽度测量（含根节点 ResizeObserver）。
 *
 * 表格 adaptive 高度仅在挂载与窗口 resize 时测量：搜索区依赖后端字段元数据异步
 * 渲染、或用户展开/收起搜索行时，上方高度变化不会触发重测，过时的高度会把分页
 * 挤出视口造成页面级滚动条。这里观察根节点尺寸变化后重算高度；可视区宽度供
 * 固定操作列宽度对齐使用（见 useTableLayout）。
 *
 * 重算用稳态解析解（见 tableMeasureMath.resolveAdaptiveHeight）：写入的值只依赖
 * 「当前高度 + 实测带符号溢出 + 期望高度」，写完后的溢出必为 0 或负、再算结果不变，
 * 因此一次收敛。此前的「按溢出增量回收」写法会让高度在期望值与回收值之间随
 * ResizeObserver 每帧互推：拖拽窗口宽度后表现为「抖两次才稳定」，窄视口分页换行时
 * 内容区整片残影。
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

  let adaptiveRaf = 0;
  /**
   * 写后复测轮次：稳态解正常一轮即收敛（复测拿到同一取值）；写高后内容仍在
   * 折行/布局中间态时最多再复测两轮，避免无限递归。
   */
  let verifyPasses = 0;
  /** 上次实测的侧栏/内容区宽度（拖动时逐步变化） */
  let lastRootWidth = -1;
  let widthSettleTimer: ReturnType<typeof setTimeout> | null = null;

  const applyAdaptiveTableHeight = () => {
    cancelAnimationFrame(adaptiveRaf);
    adaptiveRaf = requestAnimationFrame(() => {
      const table = rootRef.value?.querySelector<HTMLElement>(
        ".pure-table .el-table"
      );
      if (!table || !table.isConnected) return;
      const rect = table.getBoundingClientRect();
      if (!rect.height) return;
      /**
       * 宽度变化（拖拽窗口 / 拖拽侧栏）：内容折行结果滞后于宽度，此刻按当前
       * 高度重算会「折行 → 校正 → 再折行」连续调整，观感就是拖动时反复抖动。
       * 拖动期间保持当前高度不动，等宽度稳定后再一次算到位（稳态解一步收敛）。
       */
      const rootWidth = rootRef.value?.clientWidth ?? 0;
      if (rootWidth !== lastRootWidth) {
        const firstMeasure = lastRootWidth < 0;
        lastRootWidth = rootWidth;
        if (widthSettleTimer) clearTimeout(widthSettleTimer);
        widthSettleTimer = setTimeout(() => {
          widthSettleTimer = null;
          applyAdaptiveTableHeight();
        }, WIDTH_SETTLE_MS);
        if (!firstMeasure) return;
      }
      // 1px 余量：宁可少 1px，也不让内容区出现常驻滚动条
      const desired =
        Math.round(window.innerHeight - rect.top - resolveOffsetBottom()) - 1;
      const next = resolveAdaptiveHeight(
        rect.height,
        desired,
        resolvePageOverflow(table)
      );
      if (Math.abs(rect.height - next) <= 1) {
        // 已收敛：允许下一轮重新校正
        verifyPasses = 0;
        return;
      }
      table.style.height = `${next}px`;
      // 本轮测量发生在写入之前：复测一轮确认稳态（分页折行等布局中间态可再等一轮）
      if (verifyPasses < 2) {
        verifyPasses += 1;
        applyAdaptiveTableHeight();
      } else {
        verifyPasses = 0;
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
    if (widthSettleTimer) clearTimeout(widthSettleTimer);
  });

  return {
    tableElWidth,
    applyAdaptiveTableHeight,
    measureTableWidth,
    ensureRootObserver
  };
}
