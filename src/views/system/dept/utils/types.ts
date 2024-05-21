// 虽然字段很少 但是抽离出来 后续有扩展字段需求就很方便了

interface FormItemProps {
  pk?: number;
  rank?: number;
  user_count?: number;
  parent?: string;
  name?: string;
  code?: string;
  roles?: number[];
  mode_type?: number | object;
  is_active?: boolean;
  auto_bind?: boolean;
  description?: string;
}

interface FormProps {
  formInline: FormItemProps;
  treeData?: any[];
  showColumns?: any[];
  isAdd?: boolean;
}

interface itemProps {
  name?: string;
  pk?: string;
  mode_display?: string;
}

interface RoleFormItemProps {
  name?: string;
  code?: string;
  mode_type?: number | object;
  /** 选中的角色列表 */
  rules: Record<number, unknown>[];
  roles: Record<number, unknown>[];
}

interface RoleFormProps {
  formInline: RoleFormItemProps;
  /** 角色列表 */
  rolesOptions: any[];
  rulesOptions: any[] | itemProps[];
  modeChoices: any[];
}

interface LeaderFormItemProps {
  name?: string;
  code?: string;
  leaders: Record<number, unknown>[];
}

interface LeaderFormProps {
  formInline: LeaderFormItemProps;
}

export type {
  FormItemProps,
  FormProps,
  RoleFormItemProps,
  RoleFormProps,
  LeaderFormItemProps,
  LeaderFormProps
};
