import { BaseApi } from "@/api/base";

type ForceLogoutResult = {
  code: number;
  detail: string;
  data: { channels: number };
};

type BatchForceLogoutResult = {
  code: number;
  detail: string;
  data: { users: number; channels: number };
};

/** 在线用户（WS 会话）管理 */
class UserOnlineApi extends BaseApi {
  /** 强制下线该用户全部会话（服务端令牌失效 + WS 踢线） */
  forceLogout = (pk: number | string) => {
    return this.request<ForceLogoutResult>(
      "post",
      {},
      {},
      `${this.baseApi}/${pk}/force-logout`
    );
  };

  /** 批量强制下线（按选中行去重用户） */
  batchForceLogout = (pks: Array<string | number>) => {
    return this.request<BatchForceLogoutResult>(
      "post",
      {},
      pks,
      `${this.baseApi}/batch-force-logout`
    );
  };
}

export const userOnlineApi = new UserOnlineApi("/api/system/online");
