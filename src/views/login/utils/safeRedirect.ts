/** 回跳目标防御性收紧：只接受站内绝对路径（排除 `//host` 协议相对地址） */
export function safeRedirectTarget(value: unknown, fallback: string): string {
  const target = typeof value === "string" ? value.trim() : "";
  return target.startsWith("/") && !target.startsWith("//") ? target : fallback;
}
