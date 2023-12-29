interface FormItemProps {
  name?: string;
  match?: string;
  type?: string;
  value?: string;
}

interface FormProps {
  formInline?: FormItemProps;
  fieldLookupsData?: any[];
  ruleList?: any[];
  dataList?: any[];
  valuesData?: any[];
}

export type { FormItemProps, FormProps };
