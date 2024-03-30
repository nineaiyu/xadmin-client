interface FormItemProps {
  pk?: number;
  key: string;
  value: string;
  cache_value?: string;
  description?: string;
  is_active?: boolean;
  inherit?: boolean;
  access?: boolean;
}

interface FormProps {
  formInline: FormItemProps;
  showColumns: any[];
  isAdd?: boolean;
}

export type { FormItemProps, FormProps };
