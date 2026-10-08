/**
 * 审批人取值编解码（节点编辑器与规则表单共用）。
 *
 * 服务端契约：`assignee_value` 为逗号分隔串；前端 el-select 多选以数组承载，
 * 两态之间用本模块转换（历史数据里可能残留多余空白，解码时统一 trim）。
 */

/** 逗号分隔串 → 多选数组（空串与空白项剔除） */
export function splitValues(value: string): string[] {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

/** 多选数组（或单值）→ 逗号分隔串 */
export function joinValues(values: unknown): string {
  return (Array.isArray(values) ? values : [values]).map(String).join(",");
}
