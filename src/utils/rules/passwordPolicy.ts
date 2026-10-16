import type { useI18n } from "vue-i18n";

/**
 * 密码安全策略（唯一入口）：**校验**与**随机生成**共用同一份规则键与口径。
 *
 * 此前校验（`utils/password.ts`）与随机生成（`utils/randomPassword.ts`）两套
 * 独立实现，靠注释约定「口径必须一致」——规则键字面量在两处各写一遍，新增
 * 类别时极易只改一处（生成出通不过校验的密码）。现收敛到本模块：
 * - 规则键集中为 `PASSWORD_RULE_KEYS`；
 * - 「value=0 视为关闭」的判定两处共用 `isRuleEnabled`；
 * - 生成器保证产物必然通过校验（单测以 100 次采样钉住）。
 *
 * `utils/password.ts` / `utils/randomPassword.ts` 保留为再导出，调用面不变。
 */

type TFunction = ReturnType<typeof useI18n>["t"];

/** 后端 `SECURITY_PASSWORD_*` 规则键（与表单校验、随机生成同源） */
export const PASSWORD_RULE_KEYS = {
  MIN_LENGTH: "SECURITY_PASSWORD_MIN_LENGTH",
  UPPER_CASE: "SECURITY_PASSWORD_UPPER_CASE",
  LOWER_CASE: "SECURITY_PASSWORD_LOWER_CASE",
  NUMBER: "SECURITY_PASSWORD_NUMBER",
  SPECIAL_CHAR: "SECURITY_PASSWORD_SPECIAL_CHAR"
} as const;

export interface PasswordRuleItem {
  key: string;
  value: number;
}

/** 最小长度 */
const wordMinLength = (word: string, minLength: number) => {
  return word?.match(new RegExp("^(.{" + minLength + ",})$"));
};

/** 大写字母 */
const wordUpperCase = (word: string) => word?.match(/([A-Z]+)/);

/** 小写字母 */
const wordLowerCase = (word: string) => word?.match(/([a-z]+)/);

/** 数字字符 */
const wordNumber = (word: string) => word?.match(/([\d]+)/);

/** 特殊字符 */
const wordSpecialChar = (word: string) =>
  word?.match(
    /[`,~,!,@,#,\$,%,\^,&,\*,\(,\),\-,_,=,\+,\{,\},\[,\],\|,\\,;,',:,",\,,\.,<,>,\/,\?]+/
  );

/** 规则项是否启用（`value=0` 视为关闭；校验与生成共用同一判定） */
export function isRuleEnabled(
  rules: PasswordRuleItem[] | undefined,
  key: string
): boolean {
  const item = (rules ?? []).find(rule => rule.key === key);
  return Boolean(Number(item?.value) || 0);
}

/**
 * 按 `SECURITY_PASSWORD_*` 规则逐条校验密码，返回是否全部满足与拼装好的
 * i18n 提示文案。生成器（`generateRandomPassword`）按同一份规则键产出必过校验的密码。
 */
export const passwordRulesCheck = (
  word: string,
  rules: Array<{ value: number; key: string }>,
  t: TFunction
) => {
  let result = true;
  let msg = t("settingPassword.tips");
  for (const rule of rules) {
    switch (rule.key) {
      case PASSWORD_RULE_KEYS.MIN_LENGTH:
        result = result && Boolean(wordMinLength(word, rule.value));
        msg = `${msg},${t("settingPassword.minLength", { length: rule.value })}`;
        break;
      case PASSWORD_RULE_KEYS.UPPER_CASE:
        if (rule.value) {
          msg = `${msg},${t("settingPassword.upperCase")}`;
          result = result && Boolean(wordUpperCase(word));
        }
        break;
      case PASSWORD_RULE_KEYS.LOWER_CASE:
        if (rule.value) {
          msg = `${msg},${t("settingPassword.lowerCase")}`;
          result = result && Boolean(wordLowerCase(word));
        }
        break;
      case PASSWORD_RULE_KEYS.NUMBER:
        if (rule.value) {
          msg = `${msg},${t("settingPassword.number")}`;
          result = result && Boolean(wordNumber(word));
        }
        break;
      case PASSWORD_RULE_KEYS.SPECIAL_CHAR:
        if (rule.value) {
          msg = `${msg},${t("settingPassword.specialChar")}`;
          result = result && Boolean(wordSpecialChar(word));
        }
        break;
    }
  }
  return { result, msg };
};

/** 去掉易混淆字符（I/l/1、O/0）的字符集 */
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGIT = "23456789";
const SPECIAL = "!@#$%^&*()-_=+[]{};:,.?";

const DEFAULT_LENGTH = 12;
const MIN_LENGTH = 8;
const MAX_LENGTH = 32;

function randomInt(max: number): number {
  if (max <= 1) return 0;
  const buffer = new Uint32Array(1);
  // 拒绝采样消除取模偏差
  const limit = Math.floor(0xffffffff / max) * max;
  let value = 0;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return value % max;
}

function pick(charset: string): string {
  return charset[randomInt(charset.length)];
}

function shuffle(items: string[]): string[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * 生成满足安全策略的随机密码（默认长度 12，最短 8，最长 32）。
 * 随机源为 WebCrypto（getRandomValues）。
 */
export function generateRandomPassword(
  rules: PasswordRuleItem[] = [],
  fallbackLength = DEFAULT_LENGTH
): string {
  const minLength =
    Number(
      (rules ?? []).find(rule => rule.key === PASSWORD_RULE_KEYS.MIN_LENGTH)
        ?.value
    ) || 0;
  const length = Math.min(
    Math.max(minLength, fallbackLength, MIN_LENGTH),
    MAX_LENGTH
  );

  const required: string[] = [];
  if (isRuleEnabled(rules, PASSWORD_RULE_KEYS.UPPER_CASE))
    required.push(pick(UPPER));
  if (isRuleEnabled(rules, PASSWORD_RULE_KEYS.LOWER_CASE))
    required.push(pick(LOWER));
  if (isRuleEnabled(rules, PASSWORD_RULE_KEYS.NUMBER))
    required.push(pick(DIGIT));
  if (isRuleEnabled(rules, PASSWORD_RULE_KEYS.SPECIAL_CHAR))
    required.push(pick(SPECIAL));
  // 未声明任何类别规则：按「大小写 + 数字」兜底，保证基础强度
  if (required.length === 0) {
    required.push(pick(UPPER), pick(LOWER), pick(DIGIT));
  }

  const pool = [UPPER, LOWER, DIGIT, SPECIAL].join("");
  const chars = [...required];
  while (chars.length < length) chars.push(pick(pool));
  return shuffle(chars).join("").slice(0, length);
}
