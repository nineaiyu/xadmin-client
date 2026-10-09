import type { BaseApi } from "@/api/base";

/**
 * 表单动作所需的 API 面：页面装配保证存在（调用点均受权限点控制），
 * 显式收窄类型避免逐处判空。
 */
export type PlusPageFormApi = Pick<
  BaseApi,
  "destroy" | "batchDestroy" | "create" | "partialUpdate" | "detail"
>;
