import type { Component } from "vue";
import type { PlusSearchProps, RecordType } from "plus-pro-components";
import type { PaginationProps } from "@pureadmin/table";
import type { BaseApi } from "@/api/base";
import type { formDialogOptions } from "./handle";

interface SearchFieldsProps {
  page: number;
  size: number;
  ordering: string;
}

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

interface EditFormProps {
  form?: Component;
  formProps?: object;
  columns?: any[] | Function;
  row?: object;
  title?: string;
  props?: object;
  options?: object;
}

interface FormProps {
  localeName?: string;
  auth?: ApiAuthProps | any;
  api: ApiAuthProps | any;
}

interface PlusPageProps {
  api: BaseApi;
  auth: ApiAuthProps;
  localeName?: string;
  /**
   * PlusSearchProps
   */
  search?: Partial<PlusSearchProps>;
  /**
   * 对通过 request 获取的数据进行处理
   * @param data
   */
  resultFormat?: <T = RecordType[]>(data: T[]) => T[];
  /**
   * 搜索之前进行一些修改
   * @param params
   */
  beforeSearchSubmit?: <T = RecordType>(params: T) => T;
  pagination?: PaginationProps;
  addOrEditOptions?: {
    title?: "";
    props?: formDialogOptions;
    form?: undefined;
  };
}

export type {
  FormProps,
  ApiAuthProps,
  SearchFieldsProps,
  EditFormProps,
  PlusPageProps
};
