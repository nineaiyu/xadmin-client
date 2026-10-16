/**
 * 时间展示口径：ISO 8601（含毫秒/微秒与 Z / 时区偏移）转为本地可读
 * `YYYY-MM-DD HH:mm:ss`；非 ISO 值原样返回字符串（空值返回空串）。
 *
 * 用于后端直出 ISO 原文的场景（`values()` 行数据、手写表格列）——
 * 元数据驱动表格的时间列已由框架渲染器格式化，两处口径保持一致。
 */
export const formatDateTime = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "";
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(text)) return text;
  // 微秒（6 位小数）先截到毫秒：运行时只保证 3 位小数可解析
  const date = new Date(text.replace(/(\.\d{3})\d+/, "$1"));
  if (Number.isNaN(date.getTime())) return text;
  const pad = (num: number) => String(num).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
};

/**
 * 字节数可读化（B / KB / MB，KB 与 MB 保留一位小数）：附件大小等
 * 「后端直出字节数」场景共用；空值/0 返回空串（由调用方决定占位）。
 */
export const formatFileSize = (size?: number | null): string => {
  const value = Number(size ?? 0);
  if (!value) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
};
