interface FormItemProps {
  /** ID */
  pk?: string;
  name?: string;
  description?: string;
  rank?: string;
  file_id?: string;
  film?: string;
  file_pk?: string;
  files?: {
    file_id: string;
    pk: string;
  };
  enable?: boolean;
}

interface FormProps {
  formInline: FormItemProps;
}

export type { FormItemProps, FormProps };
