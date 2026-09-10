import { passwordRulesCheck } from "@/utils";
import type { PasswordRule } from "@/api/auth";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 密码规则校验器（el-form validator）。
 *
 * 重置密码弹窗与用户新增/编辑表单共用同一实现，避免两处校验规则与提示文案漂移。
 */
export function buildPasswordValidator(
  t: TFunction,
  passwordRules: { value: PasswordRule[] }
) {
  return (rule: unknown, value: unknown, callback: (error?: Error) => void) => {
    const { result, msg } = passwordRulesCheck(
      value as string,
      passwordRules.value,
      t
    );
    if (result) {
      callback();
    } else {
      callback(new Error(msg));
    }
  };
}
