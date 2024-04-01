import type { Component } from "vue";

interface ApiAuthProps {
  list?: string | boolean | null;
  create?: string | boolean | null;
  delete?: string | boolean | null;
  update?: string | boolean | null;
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
  auth?: ApiAuthProps;
  api: ApiAuthProps;
  editForm?: EditFormProps;
  pagination?: object | null;
  searchForm: object | null;
  searchColumns: any[];
  tableColumns: any[];
  customAddOrEdit?: boolean;
  resultFormat?: Function;
}

export type { ApiAuthProps, FormProps };
