interface FormItemProps {
  /** ID */
  pk?: string;
  name?: string;
  description?: string;
  enable?: boolean;
}

interface FormProps {
  formInline: FormItemProps;
}

export type { FormItemProps, FormProps };
