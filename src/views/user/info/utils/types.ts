type ChoicesLabel = { label?: string };

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
  dept_info?: {
    name?: string;
    pk?: number;
  };
  /** 性别 */
  gender?: number | ChoicesLabel;
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
  genderChoices: any[];
}

interface FormPasswordProps {
  old_password: string;
  new_password: string;
  sure_password?: string;
}

export type { FormItemProps, FormProps, FormPasswordProps };
