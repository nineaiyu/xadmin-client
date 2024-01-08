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
}

export type { FormItemProps, FormProps };
