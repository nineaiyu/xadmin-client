/**
 * AiResultTable 对外类型（props 单一来源，组件与消费端共用）。
 *
 * 只读动作结果表：columns/rows、series、results、键值对象四种形态自动成表。
 */

export interface AiResultTableProps {
  data: Record<string, unknown>;
}
