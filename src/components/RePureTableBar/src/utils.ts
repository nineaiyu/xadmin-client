import { computed, ref, type ComputedRef, type PropType, type Ref } from "vue";
import { delay } from "@pureadmin/utils";
import { transformI18n } from "@/plugins/i18n";
import { cn } from "@/utils/cn";

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
  /** 头部最左边的标题（未传时回落语言包词条） */
  title: {
    type: String,
    default: () => transformI18n("tableBar.list")
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
  },
  /**
   * 父级刷新请求的真实状态（可选）：回传后刷新图标跟随实际请求，
   * 未回传（null）时退回 500ms 兜底动画。
   */
  refreshLoading: {
    type: Boolean as PropType<boolean | null>,
    default: null
  }
};

/** 图标按钮通用类名 */
export const ICON_CLASS = [
  "text-fg",
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
  "border-border"
];

/** 容器类名：全屏时铺满并提升层级，否则保留上边距；
 *  宽度类冲突由 cn（tailwind-merge）收敛——全屏分支胜出，不残留 w-99/100，
 *  因此无需 important 压制 */
export function buildRenderClass(isFullscreen: boolean) {
  return cn(
    "w-99/100 px-2 pb-2 bg-bg-card",
    isFullscreen
      ? "w-full h-full z-2002 fixed inset-0 re-plus-table-card--fullscreen"
      : "mt-2"
  );
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

/**
 * 刷新按钮 loading 状态。
 *
 * 父级回传真实请求状态（`refreshLoading`）时完全由父级驱动，
 * 否则退回固定 `fallbackMs` 兜底动画——避免长请求已结束仍转、短请求转不够。
 */
export function createRefreshState(
  pending: ComputedRef<boolean | null>,
  requestRefresh: () => void,
  fallbackMs = 500
) {
  const fallback = ref(false);
  const loading = computed(() => pending.value ?? fallback.value);
  function onReFresh() {
    requestRefresh();
    if (pending.value !== null) return;
    fallback.value = true;
    delay(fallbackMs).then(() => (fallback.value = false));
  }
  return { loading, onReFresh };
}

/** 密度下拉项样式（选中项主色底白字）：消费方传当前密度与主题色 */
export function buildDropdownItemStyle(
  size: Ref<string>,
  themeColor: ComputedRef<string | undefined>
): (s: string) => Record<string, string> {
  return s => ({
    background: s === size.value ? (themeColor.value ?? "") : "",
    color:
      s === size.value
        ? "var(--el-color-white)"
        : "var(--el-text-color-primary)"
  });
}

/**
 * 列设置面板的勾选态（勾选项 / 全选 / 半选）。
 *
 * 必须基于「应用偏好后的列」计算：偏好把某列 hide=true 时，勾选项要同步移除，
 * 否则面板显示全选、实际表格少列，用户点一次「全选」也恢复不了被偏好隐藏的列。
 */
export function resolveColumnCheckState(columns: TableColumnLike[]): {
  checked: string[];
  all: boolean;
  indeterminate: boolean;
} {
  const labels = (items: TableColumnLike[]) =>
    items
      .map(item => (typeof item?.label === "string" ? item.label : ""))
      .filter(Boolean);
  const total = labels(columns ?? []);
  const checked = labels((columns ?? []).filter(item => item?.hide !== true));
  return {
    checked,
    all: total.length > 0 && checked.length === total.length,
    indeterminate: checked.length > 0 && checked.length < total.length
  };
}
