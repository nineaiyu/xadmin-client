import { isEmail } from "@pureadmin/utils";
import type { FormItemRule } from "element-plus";

/**
 * 邮箱校验的唯一入口。
 *
 * 此前「邮箱格式」在字段类型注册表（表格表单的通用 email 字段）与验证码组件
 * 各写一份，提示文案与必填处理分叉。现统一到本模块：判定委托
 * `@pureadmin/utils`，表单规则由 `buildEmailRule` 装配。
 */

/** 邮箱判定（委托 @pureadmin/utils 的 isEmail） */
export function isEmailAddress(value: unknown): boolean {
  return isEmail(String(value ?? ""));
}

/**
 * 邮箱表单规则（用于 el-form 的 rules）。
 *
 * `requiredMessage` 用于「为空且必填」场景的自定义文案（验证码组件口径）；
 * 不传则只做格式校验，非空由规则对象的 `required` 交给 el-form 内置处理
 * （字段类型注册表口径）。
 */
export function buildEmailRule(options: {
  /** 是否必填（透传给规则对象） */
  required?: boolean;
  /** 为空时的提示；不传则由 `required` 内置文案接管 */
  requiredMessage?: string;
  /** 格式错误提示 */
  formatMessage: string;
}): FormItemRule {
  return {
    required: options.required,
    validator: (
      _rule: unknown,
      value: unknown,
      callback: (error?: Error) => void
    ) => {
      if (value === "" || value === null || value === undefined) {
        callback(
          options.requiredMessage
            ? new Error(options.requiredMessage)
            : undefined
        );
        return;
      }
      if (!isEmailAddress(value)) {
        callback(new Error(options.formatMessage));
        return;
      }
      callback();
    },
    trigger: "blur"
  };
}
