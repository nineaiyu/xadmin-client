// 虽然字段很少 但是抽离出来 后续有扩展字段需求就很方便了

interface FormItemProps {
  /** ID */
  pk?: number;
  /** 用户名 */
  username: string;
  /** 昵称 */
  nickname: string;
  /** 头像 */
  avatar: string;
  /** 手机号码 */
  mobile?: string;
  /** 邮箱 */
  email?: string;
  /** 性别 */
  gender?: number | object;
  mode_type?: number;
  /** 角色 */
  roles?: number[];
  rules?: number[];
  /** 密码 */
  password?: string;
  /** 是否激活 */
  is_active?: boolean;
  /** 备注 */
  description?: string;
  /** 所属部门 */
  dept?: string;
}

interface FormProps {
  formInline: FormItemProps;
  treeData: any[];
  genderChoices: any[];
  showColumns: any[];
  isAdd?: boolean;
}

interface RoleFormItemProps {
  username: string;
  nickname: string;
  mode_type?: number | object;
  /** 选中的角色列表 */
  roles: Record<number, unknown>[];
  rules: Record<number, unknown>[];
}

interface RoleFormProps {
  formInline: RoleFormItemProps;
  /** 角色列表 */
  rolesOptions: any[];
  rulesOptions: any[];
  modeChoices: any[];
}

export type { FormItemProps, FormProps, RoleFormItemProps, RoleFormProps };
