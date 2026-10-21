/**
 * 业务校验规则唯一入口（手机号 / 邮箱 / 链接 / IP / 确认密码 / 密码策略）。
 *
 * 收敛背景：同一业务语义此前在多处各写一份（手机号两处、邮箱两处、确认密码
 * 两处、链接在列表页框架内、密码校验与随机生成两套独立实现），提示文案与
 * 严格度随入口漂移且无门禁。现统一登记到本目录，页面只装配不实现。
 *
 * 使用约定：
 * - 判定谓词直接 import 本目录（深路径亦可，避免经桶文件连带加载无关模块）；
 * - 组件框架（如 RePlusPage）请按需深路径引入（`@/utils/rules/email`），
 *   不要 import 本目录的桶，以防引入不需要的依赖。
 */

export {
  buildPhoneRule,
  isPhoneNumber,
  isInternationalPhoneNumber
} from "./phone";
export { isColorValue } from "./color";
export { buildEmailRule, isEmailAddress } from "./email";
export { isExternalRoute, isUrl } from "./url";
export { isIpAddress, isIPv4, isIPv6 } from "./ip";
export { buildRepeatPasswordValidator } from "./confirmPassword";
export {
  PASSWORD_RULE_KEYS,
  passwordRulesCheck,
  generateRandomPassword,
  isRuleEnabled
} from "./passwordPolicy";
export type { PasswordRuleItem } from "./passwordPolicy";
