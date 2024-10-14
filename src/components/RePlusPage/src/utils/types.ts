import type {
  PlusColumn,
  PlusDescriptionsProps,
  PlusSearchProps,
  RecordType
} from "plus-pro-components";
import type {
  PaginationProps,
  PureTableProps,
  TableColumnRenderer,
  TableColumns
} from "@pureadmin/table";
import type { BaseApi } from "@/api/base";
import type { formDialogOptions } from "./handle";
import type { OperationProps } from "@/components/RePlusPage";
import type { PureTableBarProps } from "@/components/RePureTableBar";
import type { VNode } from "vue";
import type { Mutable } from "@vueuse/core";
import type { SearchColumnsResult, SearchFieldsResult } from "@/api/types";

interface TableColumn {
  /** 是否隐藏 */
  hide?: boolean | CallableFunction;
  /** 自定义列的内容插槽 */
  slot?: string;
  /** 自定义表头的内容插槽 */
  headerSlot?: string;
  /** 多级表头，内部实现原理：嵌套 `el-table-column` */
  children?: Array<TableColumn>;
  /** 自定义单元格渲染器（`jsx`语法） */
  cellRenderer?: (data: TableColumnRenderer) => VNode | string;
  /** 自定义头部渲染器（`jsx`语法） */
  headerRenderer?: (data: TableColumnRenderer) => VNode | string;
}

interface PageColumn extends PlusColumn, TableColumn {
  // columns: Partial<Mutable<TableColumn> & { _column: object }>[]
  _column: Partial<
    Mutable<SearchFieldsResult["data"][0]> &
      Mutable<SearchColumnsResult["data"][0]>
  >;
}

interface PageColumnList extends TableColumns {
  prop?: string;
  _column: Partial<
    Mutable<SearchFieldsResult["data"][0]> &
      Mutable<SearchColumnsResult["data"][0]>
  >;
}

interface ApiAuthProps {
  list?: string | boolean | null | BaseApi["list"];
  import?: string | boolean | null | BaseApi["import"];
  export?: string | boolean | null | BaseApi["export"];
  create?: string | boolean | null | BaseApi["create"];
  delete?: string | boolean | null | BaseApi["delete"];
  update?: string | boolean | null | BaseApi["update"];
  fields?: string | boolean | null | BaseApi["fields"];
  batchDelete?: string | boolean | null | BaseApi["batchDelete"];
}

interface RePlusPageProps {
  api: BaseApi;
  title?: string;
  auth: ApiAuthProps | any;
  selection?: boolean;
  immediate?: boolean;
  operation?: boolean;
  isTree?: boolean;
  tableBar?: boolean;
  localeName?: string;
  /**
   * PlusSearchProps
   */
  plusSearchProps?: Partial<PlusSearchProps>;
  pureTableProps?: Partial<PureTableProps>;
  pureTableBarProps?: Partial<PureTableBarProps>;
  plusDescriptionsProps?: Partial<PlusDescriptionsProps>;
  /**
   * 对通过 request 获取的数据进行处理
   * @param data
   */
  searchResultFormat?: <T = RecordType[]>(data: T[]) => T[];
  // listColumnsFormat?: (
  //   columns: PlusColumn[] | TableColumns[] | PageColumnList[]
  // ) => PlusColumn[] | TableColumns[] | PageColumnList[];
  listColumnsFormat?: (columns: PageColumnList[]) => PageColumnList[];
  detailColumnsFormat?: (columns: PageColumn[]) => PageColumn[];
  searchColumnsFormat?: (columns: PageColumn[]) => PageColumn[];
  baseColumnsFormat?: ({
    listColumns,
    detailColumns,
    searchColumns,
    addOrEditRules,
    addOrEditColumns,
    searchDefaultValue,
    addOrEditDefaultValue
  }) => void;
  /**
   * 搜索之前进行一些修改
   * @param params
   */
  beforeSearchSubmit?: <T = RecordType>(params: T) => T;
  pagination?: Partial<PaginationProps>;
  addOrEditOptions?: {
    title?: "";
    props?: Partial<formDialogOptions>;
    form?: undefined;
    apiReq?: (
      formOptions: Partial<formDialogOptions> & { formData: RecordType }
    ) => BaseApi | any;
  };
  operationButtonsProps?: Partial<OperationProps>;
  tableBarButtonsProps?: Partial<OperationProps>;
}

export type { ApiAuthProps, RePlusPageProps, PageColumn, PageColumnList };
