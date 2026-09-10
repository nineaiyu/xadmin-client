interface FormItemProps {
  name?: string[];
  match?: string;
  exclude?: boolean;
  type?: string;
  value?: string;
}

/** 字段权限规则行（一条 数据权限 过滤规则） */
export interface FieldRuleRow {
  table: string;
  field: string;
  match: string;
  exclude?: boolean;
  type?: string;
  value?: string;
}

/** 字段下拉选项（label/value 供 el-select 渲染） */
export interface FieldLookupItem {
  label: string;
  value: string;
  disabled?: boolean;
  /** 过滤语义说明（后端 choices.hint 下发，仅规则类型项有） */
  hint?: string;
}

/** 字段级联树节点（el-cascader 按 name/label/children 映射） */
export interface FieldLookupNode {
  name?: string;
  label?: string;
  value?: string;
  disabled?: boolean;
  children?: FieldLookupNode[];
}

interface FormProps {
  formInline?: FormItemProps;
  fieldLookupsData?: FieldLookupNode[];
  ruleList?: FieldLookupNode[];
  dataList?: FieldRuleRow[];
  valuesData?: FieldLookupItem[];
  /** 菜单上下文候选（配置页即时试算面板用） */
  menus?: Array<{ value: string; label: string }>;
}

export type { FormItemProps, FormProps };
