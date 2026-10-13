import { isPhone } from "@pureadmin/utils";
import type { FormItemRule } from "element-plus";

/**
 * 手机号校验的唯一入口。
 *
 * 此前「手机号格式」在用户表单与验证码组件各写一份，其中一处校验被注释掉后
 * 长期无人发现（同一业务语义两处不同口径）。现统一到本模块：判定谓词委托
 * `@pureadmin/utils`，表单规则由 `buildPhoneRule` 装配。
 */

/** 手机号判定（委托 @pureadmin/utils 的 isPhone，口径不另立标准） */
export function isPhoneNumber(value: unknown): boolean {
  return isPhone(String(value ?? ""));
}

/**
 * 手机号表单规则（用于 el-form 的 rules）。
 *
 * - `formatCheck`：是否校验格式。登录/注册/重置密码页历史口径只校验非空
 *   （格式由发送验证码接口与后端兜底），保留该口径；用户表单启用格式校验。
 * - 非空提示与格式提示分开传入：两处调用点的文案键不同，装配归口、文案不合并。
 */
export function buildPhoneRule(options: {
  /** 是否必填（透传给规则对象，交给 el-form 内置必填校验） */
  required?: boolean;
  /** 为空时的提示；不传则交给 `required` 的内置文案 */
  requiredMessage?: string;
  /** 格式错误提示 */
  formatMessage: string;
  /** 是否校验格式（默认 true） */
  formatCheck?: boolean;
}): FormItemRule {
  const checkFormat = options.formatCheck ?? true;
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
      if (checkFormat && !isPhoneNumber(value)) {
        callback(new Error(options.formatMessage));
        return;
      }
      callback();
    },
    trigger: "blur"
  };
}
