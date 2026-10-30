import { BaseApi } from "@/api/base";
import type { BaseResult, ListResult } from "@/api/types";

export interface AuthorizedApplication {
  application: {
    pk: string;
    name: string;
    client_id: string;
  };
  users: Array<{ pk: string; username: string; nickname: string }>;
  user_count: number;
  scopes: string[];
  authorized_time: string | null;
  last_used_time: string | null;
  access_token_count: number;
  refresh_token_count: number;
  status: "active" | "disabled" | "expired";
}

/** 我的已授权应用（用户侧，个人授权个人管） */
export const myAuthorizedApplicationApi = new (class extends BaseApi {
  revoke = (pk: string) => {
    return this.request<BaseResult>(
      "post",
      {},
      {},
      `${this.baseApi}/${pk}/revoke`
    );
  };
})("/api/identity/my-authorized-applications");

/** 已授权应用（管理员审计视角：全部用户，按应用聚合） */
export const authorizedApplicationApi = new (class extends BaseApi {
  revoke = (pk: string) => {
    return this.request<BaseResult>(
      "post",
      {},
      {},
      `${this.baseApi}/${pk}/revoke`
    );
  };
})("/api/identity/authorized-applications");

export type MyAuthorizedApplicationList = ListResult<AuthorizedApplication>;
