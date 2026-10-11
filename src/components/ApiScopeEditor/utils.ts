/**
 * 接口范围编辑器纯逻辑（可单测）：
 * - 自定义条目文本 ↔ 条目数组（一行一条）
 * - 勾选与自定义合并（保序去重）
 * - 历史条目分流（命中选项进勾选，其余进自定义，保证打开编辑不丢条目）
 * - HTTP 方法 → 标签色
 */

export type MethodTagType =
  "success" | "primary" | "warning" | "danger" | "info";

const METHOD_TAG_TYPES: Record<string, MethodTagType> = {
  GET: "success",
  POST: "primary",
  PUT: "warning",
  PATCH: "warning",
  DELETE: "danger"
};

/** 方法 → 标签色（未知方法取 info） */
export function methodTagType(method: string): MethodTagType {
  return METHOD_TAG_TYPES[String(method).toUpperCase()] ?? "info";
}

/** 自定义条目文本 → 条目数组（逐行去空白、丢空行） */
export function splitCustomItems(text: string): string[] {
  return String(text ?? "")
    .split("\n")
    .map(item => item.trim())
    .filter(Boolean);
}

/** 合并勾选与自定义条目（保序去重） */
export function mergeScopes(picked: string[], custom: string[]): string[] {
  const merged = [...picked, ...custom];
  return merged.filter((item, index) => merged.indexOf(item) === index);
}

/** 历史条目分流：命中选项的进勾选，其余（正则/白名单/历史手填）进自定义 */
export function splitSavedScopes(
  saved: string[],
  known: Set<string>
): { picked: string[]; rest: string[] } {
  return {
    picked: saved.filter(item => known.has(item)),
    rest: saved.filter(item => !known.has(item))
  };
}
