interface FormItemProps {
  pk?: number;
  owner?: string;
  owner_info?: object;
  key: string;
  value: string;
  cache_value?: string;
  description?: string;
  is_active?: boolean;
  access?: boolean;
  isAdd?: boolean;
  config_user?: number[];
}

interface FormProps {
  formInline: FormItemProps;
  showColumns: any[];
  isAdd?: boolean;
}

export type { FormItemProps, FormProps };
