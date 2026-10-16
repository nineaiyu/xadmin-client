/** 部门管理页共享行类型 */

/** 部门行：跳转详情与授权弹层所需字段（框架 row 宽容形态） */
export type DeptRow = {
  name?: string;
  user_count?: number;
  pk?: number | string;
} & Record<string, unknown>;
