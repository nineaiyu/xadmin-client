interface FormItemProps {
  pk?: number;
  publish?: boolean;
  level?: { value: "primary" | "success" | "warning" | "danger" | "info" };
  title?: string;
  message?: string;
  notice_type?: number | object;
}

interface FormProps {
  formInline: FormItemProps;
  isAdd?: boolean;
}

export type { FormItemProps, FormProps };
