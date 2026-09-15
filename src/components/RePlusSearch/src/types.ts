import type { BaseApi } from "@/api/base";
import type { RecordType } from "plus-pro-components";
import type { PaginationProps } from "@pureadmin/table";
import type { ComputedRef, Ref } from "vue";
import type { PageTableColumn } from "@/components/RePlusPage";
import type { PageColumn } from "@/components/RePlusPage";

interface PlusSearchProps {
  api: Partial<BaseApi>;
  isTree?: boolean;
  multiple?: boolean;
  localeName?: string;
  searchColumnsFormat?: (columns: PageColumn[]) => PageColumn[];
  listColumnsFormat?: (columns: PageTableColumn[]) => PageTableColumn[];
  baseColumnsFormat?: (payload: {
    /** 表格列（响应式 ref，就地修改生效） */
    listColumns: Ref<PageColumn[]>;
    detailColumns: Ref<PageColumn[]>;
    searchColumns: Ref<PageColumn[]>;
    addOrEditRules: Ref<Record<string, unknown>>;
    addOrEditColumns: Ref<PageColumn[]>;
    searchDefaultValue: Ref<Record<string, unknown>>;
    addOrEditDefaultValue: Ref<Record<string, unknown>>;
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
