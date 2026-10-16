import type { PageTableColumn } from "./types";

/**
 * 列表列格式化构建器：把「逐列遍历 + 按 key 分派」的样板收敛为声明式映射。
 *
 * - key 取 `column._column?.key`（框架列元数据的业务字段名，列设置偏好按此对齐）；
 * - 未命中映射的列原样保留；处理器内自由改写列（cellRenderer / minWidth / align 等）；
 * - 同一处理器可挂多个 key（如两级字典的 `parent` / `parent_code` 双 key）。
 *
 * 返回入参数组（与页面既有 `return columns` 契约一致，直接作为
 * `listColumnsFormat` 的返回值）。
 */
export function formatPageColumns(
  columns: PageTableColumn[],
  handlers: Record<string, (column: PageTableColumn) => void>
): PageTableColumn[] {
  columns.forEach(column => {
    const key = column._column?.key;
    const handler = typeof key === "string" ? handlers[key] : undefined;
    if (handler) handler(column);
  });
  return columns;
}
