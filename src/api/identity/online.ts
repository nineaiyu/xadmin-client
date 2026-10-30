import { BaseApi } from "@/api/base";

type ForceLogoutResult = {
  code: number;
  detail: string;
  data: { channels: number };
};

type BatchForceLogoutResult = {
  code: number;
  detail: string;
  data: {
    users: number;
    channels: number;
    failures?: { pk: string; reason: string }[];
  };
};

/** 在线用户（WS 会话）管理 */
class UserOnlineApi extends BaseApi {
  /** 强制下线该用户全部会话（显式 user_pk；服务端令牌失效 + WS 踢线） */
  forceLogout = (userPk: number | string) => {
    return this.request<ForceLogoutResult>(
      "post",
      {},
      { user_pk: userPk },
      `${this.baseApi}/force-logout`
    );
  };

  /** 批量强制下线（显式 session_pks，禁止再按主键类型猜测用户/日志语义） */
  batchForceLogout = (sessionPks: string[]) => {
    return this.request<BatchForceLogoutResult>(
      "post",
      {},
      { session_pks: sessionPks },
      `${this.baseApi}/batch-force-logout`
    );
  };
}

export const userOnlineApi = new UserOnlineApi("/api/identity/online");
