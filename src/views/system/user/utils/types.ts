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
  sex?: number;
  /** 角色 */
  roles?: number[];
  /** 密码 */
  password?: string;
  /** 确认密码 */
  repeatPassword?: string;
  /** 是否激活 */
  is_active?: boolean;
  /** 是否是编辑模式 */
  is_edit?: boolean;
  /** 是否是重置密码 */
  is_reset_password?: boolean;
}
interface FormProps {
  formInline: FormItemProps;
}

export type { FormItemProps, FormProps };
