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
import type {
  ApiResult,
  SearchColumnsResult,
  SearchFieldsResult
} from "@/api/types";
import type { FormInstance } from "element-plus";
import type { formDialogDrawerOptions } from "./handle";
import type { OperationProps } from "@/components/RePlusPage";
import type { PureTableBarProps } from "@/components/RePureTableBar";
import type { VNode, Component } from "vue";
import type { Mutable } from "@vueuse/core";

/**
 * 弹层表单实例契约：仅依赖 `validate`；分页签场景会在当前页实例上挂载
 * `_allInstances`，供 openDialogDrawer 统一校验全部表单（AddOrEdit 等组件实现）
 */
export type ExposedFormInstance = {
  validate: FormInstance["validate"];
  _allInstances?: ExposedFormInstance[];
};

interface TableColumn {
  /** 是否隐藏 */
  hide?: boolean | CallableFunction;
  /** 自定义列的内容插槽 */
  slot?: string;
  /** 自定义表头的内容插槽 */
  headerSlot?: string;
  /** 多级表头，内部实现原理：嵌套 `el-table-column` */
  // children?: Array<TableColumn>;
  /** 自定义单元格渲染器（`jsx`语法） */
  cellRenderer?: (data: TableColumnRenderer) => VNode | string;
  /** 自定义头部渲染器（`jsx`语法） */
  headerRenderer?: (data: TableColumnRenderer) => VNode | string;
}

interface PageColumn extends PlusColumn, TableColumn {
  /**
   * 自定义表单字段渲染器（对 plus-pro-components 的 any 签名做强类型收窄）。
   * value 的具体形态由列的 valueType / input_type 决定
   */
  renderField?: PlusRenderField;
  // columns: Partial<Mutable<TableColumn> & { _column: object }>[]
  _column: Partial<
    Mutable<SearchFieldsResult["data"][0]> &
      Mutable<SearchColumnsResult["data"][0]>
  >;
}

/** 手机号输入组件的模型（区号 + 号码），PhoneInput.vue 与渲染器共用 */
export interface PhoneInputProps {
  code: string;
  phone: string;
}

/**
 * 自定义表单字段渲染器（与 plus-pro-components 的 `renderField` 调用契约一致：
 * `value` 为动态表单字段值、`props` 为当前列，形态由列的 valueType / input_type 决定，
 * 组件侧在各自边界收窄为具体类型。
 */
export type PlusRenderField = (
  value: unknown,
  onChange: (value: unknown) => void,
  props: PlusColumn
) => VNode | Component;

/** 列元数据，同时兼容 search-fields 与 search-columns 接口返回 */
type PlusColumnMeta = SearchFieldsResult["data"][0] &
  Partial<SearchColumnsResult["data"][0]>;

/**
 * 选择型字段渲染值中的选项条目（m2m_related_field / labeled_multiple_choice 等）：
 * `label` 用于展示，`pk` / `value` 用作列表 key
 */
type ChoiceOptionItem = {
  pk?: number | string;
  value?: number | string;
  label?: string;
  [key: string]: unknown;
};

/** 列渲染器上下文：提供当前列元数据与 i18n / 自定义搜索组件依赖 */
interface PlusColumnContext {
  column: PlusColumnMeta;
  t: (arg0: string, arg1?: object) => string;
  te: (arg0: string, arg1?: string) => boolean;
  localeName: string;
  /** `api-search-*` 自定义搜索组件映射 */
  apiSearchComponents: Record<string, Component>;
}

/**
 * 列渲染处理器：对 PageColumn 就地配置（valueType / fieldProps / renderField /
 * cellRenderer 等），与原 switch-case 的 mutation 行为保持一致
 */
type PlusColumnHandler = (item: PageColumn, ctx: PlusColumnContext) => void;

/** input_type -> 处理器 的渲染器注册表 */
type PlusColumnRegistry = Record<string, PlusColumnHandler>;

interface PageTableColumn extends TableColumns {
  prop?: string;
  _column: Partial<
    Mutable<SearchFieldsResult["data"][0]> &
      Mutable<SearchColumnsResult["data"][0]>
  >;
}

interface ApiAuthProps {
  list?: string | boolean | null | BaseApi["list"];
  importData?: string | boolean | null | BaseApi["importData"];
  exportData?: string | boolean | null | BaseApi["exportData"];
  create?: string | boolean | null | BaseApi["create"];
  destroy?: string | boolean | null | BaseApi["destroy"];
  update?: string | boolean | null | BaseApi["update"];
  retrieve?: string | boolean | null | BaseApi["retrieve"];
  partialUpdate?: string | boolean | null | BaseApi["partialUpdate"];
  fields?: string | boolean | null | BaseApi["fields"];
  batchDestroy?: string | boolean | null | BaseApi["batchDestroy"];
  recycleList?: string | boolean | null | BaseApi["recycleList"];
}

/** 回收站抽屉的附加业务列（删除时间列内建，无需声明） */
interface RecycleBinColumn {
  /** 业务标识字段（如 username / name / filename / title） */
  prop: string;
  /** 表头文案；缺省时按 `${localeName}.${prop}` 自动翻译 */
  label?: string;
  /** 单元格格式化（row 为动态接口数据行） */
  formatter?: (row: RecordType) => string;
}

interface RePlusPageProps {
  api: Partial<BaseApi>;
  title?: string;
  auth: Partial<ApiAuthProps>;
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
  listColumnsFormat?: (columns: PageTableColumn[]) => PageTableColumn[];
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
    props?: Partial<formDialogDrawerOptions>;
    form?: undefined;
    apiReq?: (
      formOptions: Partial<formDialogDrawerOptions> & { formData: RecordType }
    ) => Promise<ApiResult>;
  };
  /**
   * 操作栏 按钮组方法
   */
  operationButtonsProps?: Partial<OperationProps>;
  /**
   * 工具栏 按钮组方法
   */
  tableBarButtonsProps?: Partial<OperationProps>;
  /**
   * 回收站入口（FEAT-2 软删除模型专用，按钮按 auth.recycleList 显隐）：
   * - true：仅展示主键与删除时间
   * - 数组：附加业务标识列（label 缺省按 localeName 自动翻译）
   */
  recycleBin?: boolean | RecycleBinColumn[];
}

export type {
  ApiAuthProps,
  RePlusPageProps,
  RecycleBinColumn,
  PageColumn,
  PageTableColumn,
  PlusColumnMeta,
  PlusColumnContext,
  PlusColumnHandler,
  PlusColumnRegistry,
  ChoiceOptionItem
};
