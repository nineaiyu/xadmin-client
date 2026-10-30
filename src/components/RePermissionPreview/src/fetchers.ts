/**
 * 权限预览取数单点（user / dept / role / post）。
 *
 * 与展示组件分文件，避免「预览组件 → 预设表 → 预览组件」的顶层循环导入：
 * 组件只依赖本文件的取数函数，预设表再引用同一份函数。
 */
import { deptApi } from "@/api/identity/dept";
import { postApi } from "@/api/identity/post";
import { roleApi } from "@/api/identity/role";
import { userApi } from "@/api/identity/user";
import type {
  DeptPreviewResult,
  PostPreviewResult,
  RolePreviewResult,
  UserPreviewResult
} from "@/api/types/permission-preview";

export const PREVIEW_FETCHERS = {
  user: async (pk: string): Promise<UserPreviewResult> =>
    (await userApi.preview(pk)).data,
  dept: async (pk: string): Promise<DeptPreviewResult> =>
    (await deptApi.preview(pk)).data,
  role: async (pk: string): Promise<RolePreviewResult> =>
    (await roleApi.preview(pk)).data,
  post: async (pk: string): Promise<PostPreviewResult> =>
    (await postApi.preview(pk)).data
};
