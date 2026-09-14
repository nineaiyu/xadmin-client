import { BaseApi } from "@/api/base";
import type { BaseResult } from "@/api/types";
import {
  SCOPE_CATALOG_KEYS,
  fetchScopeCatalog,
  type ScopeCatalogResponse
} from "@/utils/scopeDisplay";

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

  /** 可授权的接口范围（按本人权限收口，供令牌接口范围勾选） */
  scopeOptions = (): Promise<ScopeCatalogResponse> => {
    return this.request<ScopeCatalogResponse>(
      "get",
      {},
      {},
      `${this.baseApi}/scope-options`
    );
  };
})("/api/system/personal-access-tokens");

/**
 * 令牌接口范围目录（同页只拉一次：列表 tooltip 与勾选器共用，见 utils/scopeDisplay）。
 * 缓存键与 API 应用目录分开，避免两个端点相互串用。
 */
export function loadPatScopeCatalog(): Promise<ScopeCatalogResponse> {
  return fetchScopeCatalog(SCOPE_CATALOG_KEYS.pat, () =>
    personalAccessTokenApi.scopeOptions()
  );
}
