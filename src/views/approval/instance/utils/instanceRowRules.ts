/**
 * 审批实例行数据可见性规则（纯函数，自 useInstanceButtons 抽出便于单测直测）。
 */

/** 行数据是否含「我的当前待办」（服务端 my_task 口径：仅当前节点、指派给我、审批中） */
export const hasMyTask = (row: { my_task?: unknown }) => !!row.my_task;

/** 行状态取值：兼容 {value,label} 对象与裸字符串两种序列化形态 */
export const statusValue = (row: { status?: { value?: string } | string }) =>
  (row.status as { value?: string })?.value ?? row.status;

/**
 * 行数据是否由当前用户发起（申请人本人）。
 *
 * 催办接口只允许申请人调用（`Only the applicant can urge the application`）；
 * 「全部在途」是管理视角的巡看列表，混有他人发起的单据——只按状态显示催办会让
 * 管理者每行都看到一个必然 1001 的按钮。兼容 creator 的两种序列化形态：
 * 关联字段 {pk,label} 与裸 pk / 用户名。
 */
export const isMineCreator = (
  row: { creator?: unknown },
  currentPk: unknown
): boolean => {
  const creator = row?.creator;
  const creatorPk =
    creator && typeof creator === "object"
      ? (creator as { pk?: unknown }).pk
      : creator;
  return (
    creatorPk !== undefined &&
    creatorPk !== null &&
    String(creatorPk) === String(currentPk ?? "")
  );
};
