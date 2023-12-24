interface FormItemProps {
  /** ID */
  pk?: number;
  name: string;
  mode_display?: string;
  mode_type: number;
  rules: Object[];
  description: string;
  is_active: boolean;
}
interface FormProps {
  formInline: FormItemProps;
  fieldLookupsData?: any[];
  valuesData?: any[];
  choicesDict?: any[];
}

export type { FormItemProps, FormProps };
