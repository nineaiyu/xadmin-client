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
}

export type { PureTableBarProps };
