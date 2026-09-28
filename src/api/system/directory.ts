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

/** 通讯录查询参数：部门 / 岗位 / 关键字（username/nickname/email/phone） */
export interface DirectoryParams {
  page?: number;
  size?: number;
  dept?: number | string | "";
  posts?: number | string | "";
  keyword?: string;
  ordering?: string;
}

/** 通讯录（list:SystemDirectory 权限点；数据权限随调用者收口） */
export const directoryApi = new BaseApi("/api/system/directory");
