interface FormItemProps {
  /** ID */
  pk?: string;
  name?: string;
  rank?: string;
  category_type?: string;
  description?: string;
  enable?: boolean;
}

interface dictChoicesProps {
  label: string;
  key: string;
  disabled: boolean;
}
interface FormProps {
  formInline: FormItemProps;
  dictChoices?: dictChoicesProps[];
}

export type { FormItemProps, FormProps, dictChoicesProps };
