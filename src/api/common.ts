import { http } from "@/utils/http";

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
    flag: string | any;
    code: string;
  }>;
};

/** 资源缓存ID, 300秒自动过期 */
export const resourcesIDCacheApi = (resources?: Array<number | string>) => {
  return http.request<IDCacheResult>("post", "/api/common/resources/cache", {
    data: { resources }
  });
};

/** 获取城市code */
export const countriesApi = () => {
  return http.request<CountriesResult>("get", "/api/common/countries");
};
