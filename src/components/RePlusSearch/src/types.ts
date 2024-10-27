import type { BaseApi } from "@/api/base";
import type { RecordType } from "plus-pro-components";
import type { PaginationProps } from "@pureadmin/table";
import type { ComputedRef, Ref } from "vue";
import type { PageColumnList } from "@/components/RePlusPage";
import type { PageColumn } from "@/components/RePlusPage";

interface PlusSearchProps {
  api: BaseApi;
  isTree?: boolean;
  multiple?: boolean;
  localeName?: string;
  searchColumnsFormat?: (columns: PageColumn[]) => PageColumn[];
  listColumnsFormat?: (columns: PageColumnList[]) => PageColumnList[];
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
