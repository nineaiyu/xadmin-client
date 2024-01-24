interface FormItemProps {
  /** ID */
  pk?: number;
  name: string;
  label: string;
  parent?: number;
}

interface FormProps {
  formInline: FormItemProps;
}

export type { FormItemProps, FormProps };
