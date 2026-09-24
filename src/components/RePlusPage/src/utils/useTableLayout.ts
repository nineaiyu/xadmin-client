import { computed, onUnmounted, ref, watch, type Ref } from "vue";
import {
  collectDataColumnWidths,
  resolveOperationColumnWidth
} from "./operationColumnWidth";

/**
 * 表格列布局效果：固定操作列宽度对齐 + 列首帧隐藏。
 *
 * **固定操作列宽度对齐（列表页表头被固定列裁切修复）**：表格横向滚动时右侧固定列
 * sticky 在容器右端，覆盖区间为 `[容器宽 - 操作列宽, 容器宽]`：若某数据列跨过该区间
 * 左边界，其表头内容（列名、问号图标）会被切掉一半，出现"半个字"。这里实测容器宽度
 * 后把覆盖区左边界对齐到列边界（左侧列完整可见、右侧列整体被覆盖）——对齐只对
 * 初始滚动位置有效（滚动后裁切位置必然移动），因此仅在加宽幅度不超过
 * `ALIGN_TOLERANCE` 时应用，否则严格保持页面配置宽度（所见即配置）；
 * 无横向滚动时同样保持配置宽度。计算只依赖容器宽与数据列宽
 * （不含操作列自身），重算幂等、无循环。
 *
 * **列首帧隐藏（体验基线 U1 / 列表页 CLS 主因）**：el-table 在列挂载后用 rAF 才计算
 * 列宽（EP `requestAnimationFrame(doLayout)`），列挂载后的第一帧仍是浏览器对未定宽列
 * 的均分宽度——长表头换行（实测表头 155px → 41px）、单元格变高（86px → 53px），下一帧
 * 才回到真实列宽；该中间帧会被真实绘制并产生位移（visibility: hidden 的元素不参与
 * layout-shift 统计）。列集合每次变化（元数据到达 / 列设置调整）时隐藏表格若干帧
 * （见 LAYOUT_HOLD_FRAMES），待布局落位后再显示。
 */

/**
 * 列首帧隐藏的持续帧数。
 *
 * 2 帧是 EP `doLayout` 落位的最小窗口；但首屏渲染任务多的页面会把落位推到第 2 帧之后
 * ——用户管理页在行操作抽屉上线后实测（dev 链路）：2 帧不足，列宽回弹仍被绘制
 * （表体高度回弹 + 行高 86→53，CLS 0.25），4 帧恢复基线（CLS 0.02）。
 * 代价是表格多隐藏约 33ms（视觉无感）。新增首屏重组件后若再次观察到列宽回弹，
 * 先核查该页首屏任务量，再评估本值（由 useTableLayout.spec.ts 守护帧数语义）。
 */
export const LAYOUT_HOLD_FRAMES = 4;
export function useTableLayout(options: {
  /** 表格可视区实测宽度（useTableMeasure 提供） */
  tableElWidth: Ref<number>;
  /** 表格实际渲染来源的列（tableBarData.dynamicColumns） */
  dynamicColumns: Ref<Array<Record<string, unknown>> | undefined>;
  /** 主列表列数（列可能被就地 splice/push，长度变化也要重算） */
  listColumnsLength: Ref<number>;
  /** 操作列配置的最小宽度 */
  operationMinWidth: () => number;
}) {
  /** 对齐后的操作列宽度（无横向滚动时等于页面配置宽度） */
  const alignedOperationWidth = computed(() =>
    resolveOperationColumnWidth(
      options.tableElWidth.value,
      collectDataColumnWidths(options.dynamicColumns.value ?? []),
      options.operationMinWidth()
    )
  );

  // 列集合（元数据到达 / 列设置调整）与容器宽度变化都会重算：列对象是表格的
  // 实际渲染来源，就地改写操作列宽度即可生效（重算不依赖操作列自身宽度，
  // 幂等无循环）
  watch(
    [alignedOperationWidth, options.dynamicColumns],
    () => {
      const columns = options.dynamicColumns.value ?? [];
      const operation = columns.find(
        column =>
          (column?._column as { key?: string } | undefined)?.key === "operation"
      ) as { width?: number } | undefined;
      if (operation && operation.width !== alignedOperationWidth.value) {
        operation.width = alignedOperationWidth.value;
      }
    },
    { immediate: true, flush: "post" }
  );

  const tableLayoutPending = ref(false);
  let layoutRaf = 0;

  const holdTableUntilLaidOut = () => {
    tableLayoutPending.value = true;
    cancelAnimationFrame(layoutRaf);
    // 倒计时逐帧推进：窗口内再次变化会从头计数（不提前显示）
    const holdFrame = (remaining: number) => {
      layoutRaf = requestAnimationFrame(() => {
        if (remaining > 1) holdFrame(remaining - 1);
        else tableLayoutPending.value = false;
      });
    };
    holdFrame(LAYOUT_HOLD_FRAMES);
  };

  // 同一列集合既可能整体替换（RePureTableBar 深拷贝回写），也可能被就地
  // splice/push（列元数据装配路径），两个来源都要盯
  watch(
    [options.dynamicColumns, options.listColumnsLength],
    holdTableUntilLaidOut,
    { flush: "pre" }
  );

  onUnmounted(() => cancelAnimationFrame(layoutRaf));

  return { alignedOperationWidth, tableLayoutPending };
}
