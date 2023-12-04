interface FormItemProps {
  /** ID */
  pk?: string;
  name?: string;
  foreign_name?: string;
  sex?: string;
  birthday?: string;
  introduction?: string;
  description?: string;
  enable?: boolean;
}

interface FormProps {
  formInline: FormItemProps;
}

export type { FormItemProps, FormProps };
