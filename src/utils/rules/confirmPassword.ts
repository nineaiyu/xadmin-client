/**
 * 「确认密码」一致性校验（唯一入口）。
 *
 * 此前登录/注册/重置密码页与个人中心改密弹窗各写一份：一处必填（空值给
 * 「请再次输入密码」），一处只做一致性比对（空值走不一致提示），同一业务
 * 语义两种口径。现归口到本工厂，差异以显式选项表达。
 */

/**
 * 构造确认密码校验器（el-form validator）。
 *
 * @param getPassword 读取新密码（getter，保证触发校验时读到最新表单值）
 * @param mismatchMessage 两次输入不一致的提示
 * @param required 是否必填（默认 false：仅一致性比对，空值放行）
 * @param requiredMessage 必填场景下空值的提示（`required` 为 true 时使用）
 */
export function buildRepeatPasswordValidator(options: {
  getPassword: () => string;
  mismatchMessage: string;
  required?: boolean;
  requiredMessage?: string;
}) {
  return (
    _rule: unknown,
    value: unknown,
    callback: (error?: Error) => void
  ) => {
    const input = String(value ?? "");
    if (input === "") {
      if (options.required) {
        callback(new Error(options.requiredMessage ?? options.mismatchMessage));
        return;
      }
      callback();
      return;
    }
    if (options.getPassword() !== input) {
      callback(new Error(options.mismatchMessage));
      return;
    }
    callback();
  };
}
