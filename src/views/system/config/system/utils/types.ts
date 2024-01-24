interface FormItemProps {
  /** ID */
  pk?: number;
  key: string;
  value: string;
  cache_value?: string;
  description?: string;
  is_active?: boolean;
}

interface FormProps {
  formInline: FormItemProps;
  showColumns: any[];
  isAdd?: boolean;
}

export type { FormItemProps, FormProps };
