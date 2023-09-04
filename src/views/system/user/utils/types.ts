// 虽然字段很少 但是抽离出来 后续有扩展字段需求就很方便了

interface FormItemProps {
  title?: string;
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
  sex?: number;
  /** 角色 */
  roles?: number[];
  /** 密码 */
  password?: string;
  /** 是否激活 */
  is_active?: boolean;
  /** 备注 */
  remark?: string;
}
interface FormProps {
  formInline: FormItemProps;
}

interface RoleFormItemProps {
  username: string;
  nickname: string;
  /** 角色列表 */
  roleOptions: any[];
  /** 选中的角色列表 */
  ids: Record<number, unknown>[];
}
interface RoleFormProps {
  formInline: RoleFormItemProps;
}

export type { FormItemProps, FormProps, RoleFormItemProps, RoleFormProps };
