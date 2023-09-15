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
  roles_info?: any[];
  /** 密码 */
  password?: string;
  /** 注册时间 */
  date_joined?: string;
  /** 最近登录时间 */
  last_login?: string;
}

interface FormProps {
  formInline: FormItemProps;
}

interface FormPasswordProps {
  old_password: string;
  new_password: string;
  sure_password?: string;
}

export type { FormItemProps, FormProps, FormPasswordProps };
