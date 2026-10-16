/**
 * 随机密码生成（速赢）。
 *
 * 实现已归口 `src/utils/rules/passwordPolicy.ts`：与密码校验（`passwordRulesCheck`）
 * **同源**——规则键集中定义、`value=0 视为关闭`的判定共用，产物必然通过校验
 * （单测以 100 次采样钉住该不变式）。本文件保留原导入路径。
 */
export { generateRandomPassword } from "./rules/passwordPolicy";
export type { PasswordRuleItem } from "./rules/passwordPolicy";
