import { http } from "@/utils/http";
import type { Result } from "@/api/types";

const site = "WEB_SITE_CONFIG";
// 站点配置信息
export const getUserSiteConfigApi = (data?: object) => {
  return http.request<Result>("get", `/api/system/configs/${site}`, {
    params: data
  });
};

export const updateUserSiteConfigApi = (data?: object) => {
  return http.request<Result>("put", `/api/system/configs/${site}`, {
    data: data
  });
};
