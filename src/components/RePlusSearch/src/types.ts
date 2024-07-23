import type { BaseApi } from "@/api/base";
import type { PlusColumn, RecordType } from "plus-pro-components";
import type { PaginationProps, TableColumn } from "@pureadmin/table";
import type { ComputedRef, Ref } from "vue";

interface PlusSearchProps {
  api: BaseApi;
  isTree?: boolean;
  localeName?: string;
  searchColumnsFormat?: (columns: PlusColumn[]) => PlusColumn[];
  listColumnsFormat?: (
    columns: PlusColumn[] | TableColumn[]
  ) => PlusColumn[] | TableColumn[];
  baseColumnsFormat?: ({
    listColumns,
    detailColumns,
    searchColumns,
    addOrEditRules,
    addOrEditColumns,
    searchDefaultValue,
    addOrEditDefaultValue
  }) => void;
  pagination?: Partial<PaginationProps> & {
    size?: string;
  };
  valueProps?: {
    label:
      | string
      | Ref<string>
      | ComputedRef<string>
      | ((row: RecordType) => string | Ref<string> | ComputedRef<string>);
    value?: string;
  };
}

export type { PlusSearchProps };
