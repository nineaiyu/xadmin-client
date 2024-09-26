interface PureTableBarProps {
  title?: string;
  tableRef?: PropType<any>;
  columns: Array<PropType<TableColumnList>>;
  isExpandAll?: boolean;
  tableKey?: PropType<string | number>;
}

export type { PureTableBarProps };
