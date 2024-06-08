import { http } from "@/utils/http";

export type IDCacheResult = {
  detail: string;
  code: number;
  spm: string;
};

/** 资源缓存ID, 300秒自动过期 */
export const resourcesIDCacheApi = (resources?: Array<number | string>) => {
  return http.request<IDCacheResult>("post", "/api/common/resources/cache", {
    data: { resources }
  });
};
