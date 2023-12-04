interface FormItemProps {
  /** ID */
  pk?: string;
  name?: string;
  picture?: string;
  route?: string;
  rank?: string;
  description?: string;
  enable?: boolean;
}

interface FormProps {
  formInline: FormItemProps;
}

export type { FormItemProps, FormProps };
