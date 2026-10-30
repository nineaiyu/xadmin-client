/** 主题模式枚举归一：登录页等 el-switch 入口可能传入 boolean，不能原样持久化。 */
export function normalizeThemeMode(value?: unknown): string {
  return typeof value === "string" &&
    ["", "system", "light", "dark"].includes(value)
    ? value
    : "";
}
