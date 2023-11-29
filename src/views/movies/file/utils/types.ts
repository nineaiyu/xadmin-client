interface FormItemProps {
  pk?: string;
  name?: string;
  file_id?: string;
  autoplay?: boolean;
  init?: boolean;
}

interface FormProps {
  formInline: FormItemProps;
}

export type { FormItemProps, FormProps };
