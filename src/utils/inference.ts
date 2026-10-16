/**
 * 值判定工具。
 */

/**
 * 返回第一个既非 `undefined` 也非 `null` 的值；全为空时返回 `undefined`。
 *
 * 与 `??` 链的区别：`??` 只跳过 `null | undefined` 但表达式需逐个书写，
 * 本函数接受任意个候选值，便于「插槽 → attrs → props → state」的取值优先级编排。
 */
export function getFirstNonNullOrUndefined<T>(
  ...values: (null | T | undefined)[]
): T | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}
