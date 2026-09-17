import type { PropType } from "vue";

/** 树形表格行：展开/折叠按 `children` 递归 */
export type TableRowLike = Record<string, unknown> & {
  children?: TableRowLike[];
};

/** 列表列类型（pure-admin `TableColumnList` 元素） */
export type TableColumnLike = TableColumnList[number];

/**
 * 树形表格实例契约：传入 pure-table 的 ref 以启用展开/折叠功能。
 * 仅声明本组件依赖的成员（`data` 行集合、`toggleRowExpansion`、`size` 门控展开图标）
 */
export interface ExpandableTableInstance {
  data?: TableRowLike[];
  toggleRowExpansion?: (row: TableRowLike, expanded?: boolean) => void;
  size?: unknown;
}

/** 组件 props 声明 */
export const tableBarProps = {
  /** 头部最左边的标题 */
  title: {
    type: String,
    default: "列表"
  },
  /** 对于树形表格，如果想启用展开和折叠功能，传入当前表格的ref即可 */
  tableRef: {
    type: Object as PropType<ExpandableTableInstance>
  },
  /** 需要展示的列 */
  columns: {
    type: Array as PropType<TableColumnList>,
    default: () => []
  },
  isExpandAll: {
    type: Boolean,
    default: true
  },
  tableKey: {
    type: [String, Number] as PropType<string | number>,
    default: "0"
  }
};

/** 图标按钮通用类名 */
export const ICON_CLASS = [
  "text-black",
  "dark:text-white",
  "duration-100",
  "hover:text-primary!",
  "cursor-pointer",
  "outline-hidden"
];

/** 弹层头部类名 */
export const TOP_CLASS = [
  "flex",
  "justify-between",
  "pt-0.75",
  "px-2.75",
  "border-b",
  "border-b-solid",
  "border-[#dcdfe6]",
  "dark:border-[#303030]"
];

/** 容器类名：全屏时铺满并提升层级，否则保留上边距 */
export function buildRenderClass(isFullscreen: boolean) {
  return [
    "w-99/100",
    "px-2",
    "pb-2",
    "bg-bg_color",
    isFullscreen ? ["w-full!", "h-full!", "z-2002", "fixed", "inset-0"] : "mt-2"
  ];
}

/** 递归展开/折叠全部树形行（依赖表格实例的 toggleRowExpansion） */
export function toggleRowExpansionAll(
  tableRef: ExpandableTableInstance | undefined,
  data: TableRowLike[],
  isExpansion: boolean
) {
  data.forEach(item => {
    tableRef?.toggleRowExpansion?.(item, isExpansion);
    if (item.children !== undefined && item.children !== null) {
      toggleRowExpansionAll(tableRef, item.children, isExpansion);
    }
  });
}

/** 列固定状态归一：`true/"right"` 归右固定，`"left"` 归左固定 */
export function resolveFixedState(column: TableColumnLike | undefined) {
  const fixedOption = column?.fixed;
  const left = fixedOption === "left";
  const right = fixedOption === true || fixedOption === "right";
  return { fixed: left || right, left, right };
}

/** 图表 tippy 统一参数（https://vue-tippy.netlify.app/props） */
export function rendTippyProps(content: string) {
  return {
    content,
    offset: [0, 18],
    duration: [300, 0],
    followCursor: true,
    hideOnClick: "toggle"
  } as const;
}
