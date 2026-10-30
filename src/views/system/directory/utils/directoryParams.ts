import type { DirectoryParams } from "@/api/identity/directory";

/** 通讯录列表查询参数（页面状态 → API 参数）：部门/岗位互斥，标签多选按 AND 逗号拼接。 */
export interface DirectoryQueryState {
  mode: "dept" | "post";
  dept: string;
  post: string;
  keyword: string;
  tags: string[];
  page?: number;
  size?: number;
}

export function buildDirectoryParams(
  state: DirectoryQueryState
): DirectoryParams {
  return {
    page: state.page,
    size: state.size,
    dept: state.mode === "dept" ? state.dept : "",
    posts: state.mode === "post" && state.post ? state.post : "",
    keyword: state.keyword.trim(),
    tag: state.tags.join(","),
    ordering: "username"
  };
}
