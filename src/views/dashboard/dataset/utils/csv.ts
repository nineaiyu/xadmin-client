import { formatDateTime } from "@/utils";

/**
 * 预览单元格展示口径（表格与 CSV 导出共用，保证"所见即所得"）：
 *
 * - 行数据来自后端 `values()`，JSON 字段是对象、时间字段是 ISO 原文，
 *   直接进表格会渲染成 `[object Object]` 与 `2026-09-22T13:07:31.030781Z`；
 * - 对象/数组序列化为 JSON；ISO 8601 时间转本地可读格式（微秒先截到毫秒再解析）。
 */
export const formatPreviewCell = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return formatDateTime(value);
};

/**
 * CSV 单元格转义（明细 / 聚合两处导出共用）：
 *
 * - 含引号 / 逗号 / 换行的文本以双引号包裹（内部引号双写）；
 * - 字符串值以 `=` `+` `-` `@` 开头时前置单引号，中和公式注入——
 *   Excel / WPS / Sheets 会把这类单元格当公式执行（CSV injection）；
 * - 非字符串（数字 / 布尔 / 对象序列化结果）不前置，避免负数与 JSON 形态变形。
 */
export function escapeCsvCell(value: unknown): string {
  const text = formatPreviewCell(value);
  const safe =
    typeof value === "string" && /^[=+@-]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
