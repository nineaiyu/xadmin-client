/**
 * 登录页子页面编号（显式枚举）。
 *
 * 历史实现用「operates 数组下标 + 1」隐式推导页面号，动数组顺序即错页；
 * 编号显式化后，各页返回跳转与「其他登录方式」按钮共用同一事实源。
 * 编号与 store 初值（currentPage: 0）及各页既有跳转保持一致。
 */
export const LOGIN_PAGE = {
  basic: 0,
  verifyCode: 1,
  register: 3,
  resetPassword: 4
} as const;

/**
 * 账户密码登录页的「其他登录方式」按钮（顺序即展示顺序）。
 *
 * title 存 i18n key 而非模块级 $t() 求值结果——模块常量只求值一次,
 * 语言切换后按钮文案不会响应;渲染处用 t(item.title) 现场翻译。
 * 按钮可见性由 Basic 页按能力清单过滤,不在此处判断。
 */
export const operates = [
  { page: LOGIN_PAGE.verifyCode, title: "login.verifyCodeLogin" },
  { page: LOGIN_PAGE.register, title: "login.register" }
] as const;
