/** 版本历史行：所有版本表共有的最小字段，业务载荷由调用方按需取用 */
export type VersionHistoryRow = {
  version: number;
  created_time?: string;
  [key: string]: unknown;
};
