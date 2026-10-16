/**
 * 审批实例行数据可见性规则（纯函数，自 useInstanceButtons 抽出便于单测直测）。
 */

/** 行数据是否含「我的当前待办」（服务端 my_task 口径：仅当前节点、指派给我、审批中） */
export const hasMyTask = (row: { my_task?: unknown }) => !!row.my_task;

/** 行状态取值：兼容 {value,label} 对象与裸字符串两种序列化形态 */
export const statusValue = (row: { status?: { value?: string } | string }) =>
  (row.status as { value?: string })?.value ?? row.status;
