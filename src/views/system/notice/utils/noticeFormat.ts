import type { MessageFormat } from "@/api/system/notice";

/**
 * 公告正文格式解析（后端 LabeledChoiceField 下发 `{value,label}`，兼容标量）。
 *
 * 缺字段（旧前端/存量数据）与未知取值一律按 `html` 处理——与模型默认值同口径，
 * 避免把富文本 HTML 误当 Markdown 源码渲染。
 */
export function resolveMessageFormat(value: unknown): MessageFormat {
  if (typeof value === "string") {
    return value === "markdown" ? "markdown" : "html";
  }
  if (value && typeof value === "object") {
    const inner = (value as { value?: unknown }).value;
    if (inner === "markdown") return "markdown";
  }
  return "html";
}
