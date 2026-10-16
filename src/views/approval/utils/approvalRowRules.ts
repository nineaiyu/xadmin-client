import type { RecordType } from "plus-pro-components";

/**
 * 审批行级可见性规则（纯函数，自 useApprovalPanel 抽出便于单测直测）：
 * 多级审批链单只有当前级候选人可审（服务端 can_act 收口），扁平单沿用页面权限。
 */

/** 多级审批链单：带当前级即「配置到某个人/角色」的逐级审批单（current_level>0） */
export const isChainRow = (row?: RecordType) =>
  Number(row?.current_level ?? 0) > 0;

/** 行级动作可见性：多级链按服务端 can_act 收口，扁平单恒可见 */
export const canActRow = (row?: RecordType) =>
  isChainRow(row) ? Boolean(row?.can_act) : true;
