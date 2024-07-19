import type {
  PlusColumn,
  PlusSearchProps,
  RecordType
} from "plus-pro-components";
import type {
  PaginationProps,
  PureTableProps,
  TableColumn
} from "@pureadmin/table";
import type { BaseApi } from "@/api/base";
import type { formDialogOptions } from "./handle";
import type { OperationProps } from "@/components/RePlusCRUD";

interface ApiAuthProps {
  list?: string | boolean | null | Function;
  import?: string | boolean | null | Function;
  export?: string | boolean | null | Function;
  create?: string | boolean | null | Function;
  delete?: string | boolean | null | Function;
  update?: string | boolean | null | Function;
  fields?: string | boolean | null | Function;
  batchDelete?: string | boolean | null | Function;
}

interface RePlusPageProps {
  api: BaseApi;
  auth: ApiAuthProps | any;
  selection?: boolean;
  operation?: boolean;
  localeName?: string;
  /**
   * PlusSearchProps
   */
  plusSearchProps?: Partial<PlusSearchProps>;
  pureTableProps?: Partial<PureTableProps>;
  /**
   * 对通过 request 获取的数据进行处理
   * @param data
   */
  searchResultFormat?: <T = RecordType[]>(data: T[]) => T[];
  listColumnsFormat?: (
    columns: PlusColumn[] | TableColumn[]
  ) => PlusColumn[] | TableColumn[];
  detailColumnsFormat?: (columns: PlusColumn[]) => PlusColumn[];
  searchColumnsFormat?: (columns: PlusColumn[]) => PlusColumn[];
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

export type { ApiAuthProps, RePlusPageProps };
