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
  /**
   * 是否有多选框， 一般为第一列
   */
  selection?: boolean;
  /**
   * 加载组件是否同时加载数据
   */
  immediate?: boolean;
  /**
   * 是否有 操作列， 一般为最后一列
   */
  operation?: boolean;
  /**
   * 是否是 树 表格
   */
  isTree?: boolean;
  /**
   * 是否有 工具栏
   */
  tableBar?: boolean;
  /**
   * 国际化，对应 locales 中
   */
  localeName?: string;
  /**
   * PlusSearchProps， 参考文档：https://plus-pro-components.com/components/search.html#search-attributes
   */
  plusSearchProps?: Partial<PlusSearchProps>;
  /**
   * pureTableProps， 参考源码：https://github.com/pure-admin/pure-admin-table
   */
  pureTableProps?: Partial<PureTableProps>;
  /**
   * pureTableBarProps
   */
  pureTableBarProps?: Partial<PureTableBarProps>;
  /**
   * plusDescriptionsProps， 参考文档：https://plus-pro-components.com/components/descriptions.html
   */
  plusDescriptionsProps?: Partial<PlusDescriptionsProps>;
  /**
   * 对通过 request 获取的数据进行处理
   * @param data
   */
  searchResultFormat?: <T = RecordType[]>(data: T[]) => T[];
  /**
   * pure table 的 columns, 并返回
   * @param columns
   */
  listColumnsFormat?: (columns: PageColumnList[]) => PageColumnList[];
  /**
   * plus pro descriptions 的 columns, 并返回
   * @param columns
   */
  detailColumnsFormat?: (columns: PageColumn[]) => PageColumn[];
  /**
   * plus pro search 的 columns, 并返回
   * @param columns
   */
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
  /**
   * 分页组件
   */
  pagination?: Partial<PaginationProps>;
  /**
   * 默认的添加，更新 方法
   */
  addOrEditOptions?: {
    title?: "";
    props?: Partial<formDialogOptions>;
    form?: undefined;
    apiReq?: (
      formOptions: Partial<formDialogOptions> & { formData: RecordType }
    ) => BaseApi | any;
  };
  /**
   * 操作栏 按钮组方法
   */
  operationButtonsProps?: Partial<OperationProps>;
  /**
   * 工具栏 按钮组方法
   */
  tableBarButtonsProps?: Partial<OperationProps>;
}

export type { ApiAuthProps, RePlusPageProps, PageColumn, PageColumnList };
