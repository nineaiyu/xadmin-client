/**
 * 字符串命名转换。
 */

/** 短横线命名转小驼峰（`foo-bar` → `fooBar`）；用于把 DOM attrs 的 kebab 键还原为 props 键 */
export function kebabToCamelCase(str: string): string {
  return str
    .split("-")
    .filter(Boolean)
    .map((word, index) =>
      index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join("");
}
