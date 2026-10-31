interface TableRefInstance {
  data?: unknown;
  toggleRowExpansion?: (row: unknown, expanded?: boolean) => void;
  size?: string;
}

interface PureTableBarProps {
  title?: string;
  tableRef?: PropType<TableRefInstance>;
  columns: Array<PropType<TableColumnList>>;
  isExpandAll?: boolean;
  tableKey?: PropType<string | number>;
  /** 父级刷新请求的真实状态；未传时刷新图标走 500ms 兜底动画 */
  refreshLoading?: boolean;
}

export type { PureTableBarProps };
