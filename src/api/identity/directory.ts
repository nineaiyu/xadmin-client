import { BaseApi } from "@/api/base";

/** 通讯录成员（只读名录行；岗位为人员维度标签，不参与权限判定） */
export interface DirectoryMember {
  pk: number;
  avatar: string | null;
  username: string;
  nickname: string | null;
  gender: { value?: string | number; label?: string } | null;
  dept: { pk: number; name: string; parent_id?: number | null } | null;
  posts: Array<{ pk: string; name: string; code: string; label: string }>;
  email: string;
  phone: string;
  is_active: boolean;
  last_login: string | null;
  date_joined: string;
}

/** 通讯录查询参数：部门（含下级） / 岗位 / 关键字（username/nickname/email/phone） */
export interface DirectoryParams {
  page?: number;
  size?: number;
  dept?: number | string | "";
  posts?: number | string | "";
  keyword?: string;
  ordering?: string;
}

/** 岗位候选（左栏岗位视角）：仅启用未删除岗位，带成员数（与岗位管理页同口径） */
export interface DirectoryPostOption {
  pk: string;
  name: string;
  code: string;
  dept: string | null;
  dept_name: string;
  rank: number;
  is_active: boolean;
  user_count: number;
}

/** 部门树节点（search/dept 候选，带部门人数标注） */
export interface DirectoryDeptNode {
  pk: string;
  name: string;
  user_count?: number;
  children?: DirectoryDeptNode[];
}

/** 通讯录（list:SystemDirectory 权限点；数据权限随调用者收口） */
export const directoryApi = new BaseApi("/api/identity/directory");
