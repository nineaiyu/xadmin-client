import type { Component } from "vue";
import type { PaginationProps } from "@pureadmin/table";

interface SearchFieldsProps {
  page: number;
  size: number;
  ordering: string;
}

interface ApiAuthProps {
  list?: string | boolean | null;
  create?: string | boolean | null;
  delete?: string | boolean | null;
  update?: string | boolean | null;
  fields?: string | boolean | null;
  batchDelete?: string | boolean | null;
}

interface EditFormProps {
  form: Component;
  row?: object;
  title?: string;
  props?: object;
  options?: object;
}

interface FormProps {
  localeName: string;
  auth?: ApiAuthProps | any;
  api: ApiAuthProps | any;
  editForm?: EditFormProps;
  pagination?: PaginationProps | null;
  tableColumns: TableColumnList;
  customAddOrEdit?: boolean;
  resultFormat?: Function;
}

export type { ApiAuthProps, FormProps, SearchFieldsProps, EditFormProps };
