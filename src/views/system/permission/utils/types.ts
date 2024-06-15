interface FormItemProps {
  /** ID */
  pk?: number;
  name: string;
  mode_type: number | object;
  rules: Object[];
  menu: number[];
  description: string;
  is_active: boolean;
}

interface FormProps {
  formInline: FormItemProps;
  fieldLookupsData?: any[];
  columns?: any[];
  valuesData?: any[];
  showColumns: any[];
  isAdd?: boolean;
}

export type { FormItemProps, FormProps };
