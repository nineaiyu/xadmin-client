/**
 * 随机密码生成与复制（F-11 速赢）。
 *
 * 按后端下发的密码安全策略（`/api/auth/rules` 的 `password_rules`，与表单校验
 * 同一份数据）生成「必然能通过校验」的强密码：value=0 的规则项视为关闭（与
 * `passwordRulesCheck` 同口径），未声明任何类别规则时按「大小写 + 数字」兜底。
 * 随机源为 WebCrypto（getRandomValues），字符集去掉易混淆字符（I/l/1、O/0）。
 */

export interface PasswordRuleItem {
  key: string;
  value: number;
}

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
 */
export function generateRandomPassword(
  rules: PasswordRuleItem[] = [],
  fallbackLength = DEFAULT_LENGTH
): string {
  const enabled = new Map(
    (rules ?? []).map(rule => [rule.key, Number(rule.value) || 0])
  );
  const minLength = Number(enabled.get("SECURITY_PASSWORD_MIN_LENGTH")) || 0;
  const length = Math.min(
    Math.max(minLength, fallbackLength, MIN_LENGTH),
    MAX_LENGTH
  );

  const required: string[] = [];
  if (enabled.get("SECURITY_PASSWORD_UPPER_CASE")) required.push(pick(UPPER));
  if (enabled.get("SECURITY_PASSWORD_LOWER_CASE")) required.push(pick(LOWER));
  if (enabled.get("SECURITY_PASSWORD_NUMBER")) required.push(pick(DIGIT));
  if (enabled.get("SECURITY_PASSWORD_SPECIAL_CHAR"))
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

/** 复制到剪贴板（Clipboard API 优先，回退 execCommand）；返回是否成功。 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 非安全上下文 / 权限被拒：走回退路径
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
