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
 * 后动态收敛操作列宽度，让覆盖区左边界恰好落在列边界上——左侧列完整可见、右侧列整体
 * 被覆盖（内容不跨界）；无横向滚动时保持页面配置宽度。计算只依赖容器宽与数据列宽
 * （不含操作列自身），重算幂等、无循环。
 *
 * **列首帧隐藏（体验基线 U1 / 列表页 CLS 主因）**：el-table 在列挂载后用 rAF 才计算
 * 列宽（EP `requestAnimationFrame(doLayout)`），列挂载后的第一帧仍是浏览器对未定宽列
 * 的均分宽度——长表头换行（实测表头 155px → 41px）、单元格变高（86px → 53px），下一帧
 * 才回到真实列宽；该中间帧会被真实绘制并产生位移（visibility: hidden 的元素不参与
 * layout-shift 统计）。列集合每次变化（元数据到达 / 列设置调整）时隐藏表格两帧，
 * 待布局落位后再显示。
 */
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
    layoutRaf = requestAnimationFrame(() => {
      layoutRaf = requestAnimationFrame(() => {
        tableLayoutPending.value = false;
      });
    });
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
