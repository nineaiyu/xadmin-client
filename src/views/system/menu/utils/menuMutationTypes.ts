import type { UnwrapNestedRefs } from "vue";
import type { menuApi } from "@/api/system/menu";

// reactive(menuApi) 的类型：UnwrapNestedRefs 映射会剥离类私有成员标记，
// 不能直接写 typeof menuApi（hasFileObject 为 private，赋值检查会缺属性报错）
export type MenuApi = UnwrapNestedRefs<typeof menuApi>;

/** 变更动作所需的 API 面（含删除前影响面预检的 baseApi/request；页面装配保证存在） */
export type MenuMutationApi = Pick<
  MenuApi,
  | "create"
  | "partialUpdate"
  | "destroy"
  | "batchDestroy"
  | "batchUpdate"
  | "rank"
  | "baseApi"
  | "request"
>;
