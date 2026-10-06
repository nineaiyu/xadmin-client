import { BaseApi } from "@/api/base";

export type IDCacheResult = {
  detail: string;
  code: number;
  spm: string;
};

export type CountriesResult = {
  detail: string;
  code: number;
  data: Array<{
    name: string;
    phone_code: string;
    flag: string;
    code: string;
  }>;
};

/** 通用资源端点：批量资源缓存 ID 与国家区号（无平台归属，独立 baseApi） */
class CommonApi extends BaseApi {
  /** 资源缓存ID, 300秒自动过期 */
  resourcesCache = (resources?: Array<number | string>) => {
    return this.request<IDCacheResult>(
      "post",
      {},
      { resources },
      `${this.baseApi}/resources/cache`
    );
  };

  /** 获取城市code */
  countries = () => {
    return this.request<CountriesResult>(
      "get",
      {},
      undefined,
      `${this.baseApi}/countries`
    );
  };
}

export const commonApi = new CommonApi("/api/common");

/* ---------------- 既有命名导出改薄委托：消费方依赖这些函数名，签名与返回类型不变 ---------------- */

/** 资源缓存ID, 300秒自动过期 */
export const resourcesIDCacheApi = (resources?: Array<number | string>) =>
  commonApi.resourcesCache(resources);

/** 获取城市code */
export const countriesApi = () => commonApi.countries();
