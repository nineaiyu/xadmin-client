import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 最小长度 */
const wordMinLength = (word: string, minLength: number) => {
  return word?.match(new RegExp("^(.{" + minLength + ",})$"));
};

/** 大写字母 */
const wordUpperCase = (word: string) => {
  return word?.match(/([A-Z]+)/);
};

/** 小写字母 */
const wordLowerCase = (word: string) => {
  return word?.match(/([a-z]+)/);
};

/** 数字字符 */
const wordNumber = (word: string) => {
  return word.match(/([\d]+)/);
};

/** 特殊字符 */
const wordSpecialChar = (word: string) => {
  return word?.match(
    /[`,~,!,@,#,\$,%,\^,&,\*,\(,\),\-,_,=,\+,\{,\},\[,\],\|,\\,;,',:,",\,,\.,<,>,\/,\?]+/
  );
};

/**
 * 按 `SECURITY_PASSWORD_*` 规则逐条校验密码，返回是否全部满足与拼装好的
 * i18n 提示文案。`generateRandomPassword`（randomPassword.ts）按同一份
 * 规则键生成必过校验的随机密码，两者口径必须保持一致。
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
      case "SECURITY_PASSWORD_MIN_LENGTH":
        result = result && Boolean(wordMinLength(word, rule.value));
        msg = `${msg},${t("settingPassword.minLength", { length: rule.value })}`;
        break;
      case "SECURITY_PASSWORD_UPPER_CASE":
        if (rule.value) {
          msg = `${msg},${t("settingPassword.upperCase")}`;
          result = result && Boolean(wordUpperCase(word));
        }
        break;
      case "SECURITY_PASSWORD_LOWER_CASE":
        if (rule.value) {
          msg = `${msg},${t("settingPassword.lowerCase")}`;
          result = result && Boolean(wordLowerCase(word));
        }
        break;
      case "SECURITY_PASSWORD_NUMBER":
        if (rule.value) {
          msg = `${msg},${t("settingPassword.number")}`;
          result = result && Boolean(wordNumber(word));
        }
        break;
      case "SECURITY_PASSWORD_SPECIAL_CHAR":
        if (rule.value) {
          msg = `${msg},${t("settingPassword.specialChar")}`;
          result = result && Boolean(wordSpecialChar(word));
        }
        break;
    }
  }
  return { result, msg };
};

/**
 * 密码强度五档配色（zxcvbn 评分 0-4）。
 *
 * 三个使用点（用户管理重置密码、个人中心改密、账号页改密）原先各写一份
 * 红/黄/绿字面色值，主题切换不跟随。此处统一取 EP 语义色：红（非常弱）→
 * 浅红（弱）→ 橙（中）→ 浅绿（强）→ 绿（非常强），深浅两档用 `-light-3`
 * 档表达，暗色主题下 EP 会重定义该档，无需页面特判。
 */
const STRENGTH_COLORS = [
  "var(--el-color-danger)",
  "var(--el-color-danger-light-3)",
  "var(--el-color-warning)",
  "var(--el-color-success-light-3)",
  "var(--el-color-success)"
] as const;

const STRENGTH_LABEL_KEYS = [
  "password.veryWeak",
  "password.weak",
  "password.average",
  "password.strong",
  "password.veryStrong"
] as const;

/** 构造五档进度条数据（色值 + 已 i18n 的档位文案） */
export function passwordStrengthLevels(t: TFunction) {
  return STRENGTH_COLORS.map((color, index) => ({
    color,
    text: t(STRENGTH_LABEL_KEYS[index])
  }));
}
