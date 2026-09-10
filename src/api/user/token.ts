import { BaseApi } from "@/api/base";
import type { BaseResult } from "@/api/types";

/** 个人访问令牌（PAT）：机器集成凭证，个人凭证个人管 */
export const personalAccessTokenApi = new (class extends BaseApi {
  /** 凭证调用记录（近似口径：本人凭证周期内的操作日志） */
  logs = (pk: string | number, params?: object) => {
    return this.request<BaseResult>(
      "get",
      params,
      {},
      `${this.baseApi}/${pk}/logs`
    );
  };

  /** 调用统计（近 7 天调用数 / 失败数 / 末次调用时间） */
  stats = (pk: string | number) => {
    return this.request<BaseResult>(
      "get",
      {},
      {},
      `${this.baseApi}/${pk}/stats`
    );
  };
})("/api/system/personal-access-tokens");
