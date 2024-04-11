interface FormItemProps {
  /** ID */
  pk?: number;
  name: string;
  mode_display?: string;
  mode_type: number;
  rules: Object[];
  menu: number[];
  description: string;
  is_active: boolean;
}

interface FormProps {
  formInline: FormItemProps;
  fieldLookupsData?: any[];
  menuPermissionData?: any[];
  valuesData?: any[];
  modeChoices?: any[];
  showColumns: any[];
  isAdd?: boolean;
}

export type { FormItemProps, FormProps };
