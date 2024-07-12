import type { Component } from "vue";

interface SearchFieldsProps {
  page: number;
  size: number;
  ordering: string;
}

interface ApiAuthProps {
  list?: string | boolean | null;
  import?: string | boolean | null;
  export?: string | boolean | null;
  create?: string | boolean | null;
  delete?: string | boolean | null;
  update?: string | boolean | null;
  fields?: string | boolean | null;
  batchDelete?: string | boolean | null;
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

export type { FormProps, ApiAuthProps, SearchFieldsProps, EditFormProps };
