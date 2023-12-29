// 虽然字段很少 但是抽离出来 后续有扩展字段需求就很方便了

interface FormItemProps {
  is_add?: boolean;
  pk?: number;
  rank?: number;
  user_count?: number;
  parent?: string;
  name?: string;
  code?: string;
  roles?: number[];
  mode_display?: string;
  mode_type?: number;
  is_active?: boolean;
  auto_bind?: boolean;
  description?: string;
}

interface FormProps {
  formInline: FormItemProps;
  treeData?: any[];
}

interface itemProps {
  name?: string;
  pk?: string;
  mode_display?: string;
}

interface RoleFormItemProps {
  name?: string;
  code?: string;
  mode_type?: number;
  mode_display?: string;
  /** 角色列表 */
  rolesOptions: any[];
  rulesOptions: any[] | itemProps[];
  choicesDict: any[];
  /** 选中的角色列表 */
  ids: Record<number, unknown>[];
  pks: Record<number, unknown>[];
}

interface RoleFormProps {
  formInline: RoleFormItemProps;
}

export type { FormItemProps, FormProps, RoleFormItemProps, RoleFormProps };
