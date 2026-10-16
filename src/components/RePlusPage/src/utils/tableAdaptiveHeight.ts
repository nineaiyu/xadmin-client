import { resolveAdaptiveHeight, resolveContentSlack } from "./tableMeasureMath";
import type { Ref } from "vue";

/** 宽度变化后的稳定窗口（ms）：期间的宽度变化视为拖动，统一推迟到最后一次变化之后重算 */
const WIDTH_SETTLE_MS = 200;

/**
 * 表格自适应高度「测量 → 稳态校正」实现（自 useTableMeasure 抽出）。
 *
 * 表格 adaptive 高度仅在挂载与窗口 resize 时测量：搜索区依赖后端字段元数据异步
 * 渲染、或用户展开/收起搜索行时，上方高度变化不会触发重测，过时的高度会把分页
 * 挤出视口造成页面级滚动条。这里按根节点尺寸变化重算高度。
 *
 * 重算用稳态解析解（见 tableMeasureMath.resolveAdaptiveHeight）：写入的值只依赖
 * 「当前高度 + 实测带符号闲置量 + 期望高度」，写完后再算结果不变，因此一次收敛。
 * 此前的「按溢出增量回收」写法会让高度在期望值与回收值之间随 ResizeObserver
 * 每帧互推：拖拽窗口宽度后表现为「抖两次才稳定」，窄视口分页换行时内容区整片残影。
 *
 * 闲置量取自内容容器实测（`resolveContentSlack`），不能用滚动容器的
 * `scrollHeight - clientHeight`：内容不足时该值恒为 0，表格偏小后永远长不回去
 * （刷新后搜索区占位收缩导致表格顶上移的场景，见 tableMeasureMath 内说明）。
 *
 * 以工厂导出（内核 + 显式 `dispose`），hook 只留生命周期与观察器接线，
 * 算法可被单测直接驱动。
 */
export function createAdaptiveHeightApplier(options: {
  rootRef: Ref<HTMLElement | undefined>;
  /** 底部预留（px）取值函数（缺省口径由调用方给，见 useTableMeasure 参数说明） */
  resolveOffsetBottom: () => number;
}) {
  let adaptiveRaf = 0;
  /**
   * 写后复测轮次：稳态解正常一轮即收敛（复测拿到同一取值）；写高后内容仍在
   * 折行/布局中间态时最多再复测两轮，避免无限递归。
   */
  let verifyPasses = 0;
  /** 上次实测的侧栏/内容区宽度（拖动时逐步变化） */
  let lastRootWidth = -1;
  let widthSettleTimer: ReturnType<typeof setTimeout> | null = null;

  /** 测量并校正表格高度（可随根节点尺寸变化重复触发） */
  const apply = () => {
    cancelAnimationFrame(adaptiveRaf);
    adaptiveRaf = requestAnimationFrame(() => {
      const table = options.rootRef.value?.querySelector<HTMLElement>(
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
      const rootWidth = options.rootRef.value?.clientWidth ?? 0;
      if (rootWidth !== lastRootWidth) {
        const firstMeasure = lastRootWidth < 0;
        lastRootWidth = rootWidth;
        if (widthSettleTimer) clearTimeout(widthSettleTimer);
        widthSettleTimer = setTimeout(() => {
          widthSettleTimer = null;
          apply();
        }, WIDTH_SETTLE_MS);
        if (!firstMeasure) return;
      }
      // 1px 余量：宁可少 1px，也不让内容区出现常驻滚动条
      const desired =
        Math.round(
          window.innerHeight - rect.top - options.resolveOffsetBottom()
        ) - 1;
      const next = resolveAdaptiveHeight(
        rect.height,
        desired,
        resolveContentSlack(options.rootRef.value)
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
        apply();
      } else {
        verifyPasses = 0;
      }
    });
  };

  /** 卸载清理：取消待执行帧与稳定窗口计时器 */
  const dispose = () => {
    cancelAnimationFrame(adaptiveRaf);
    if (widthSettleTimer) clearTimeout(widthSettleTimer);
    widthSettleTimer = null;
  };

  return { apply, dispose };
}
