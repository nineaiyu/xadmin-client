import type {
  PlusColumn,
  PlusDescriptionsProps,
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
  plusDescriptionsProps?: Partial<PlusDescriptionsProps>;
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
