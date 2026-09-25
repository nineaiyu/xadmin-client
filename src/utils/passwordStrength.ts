import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

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
