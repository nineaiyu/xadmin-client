import { http } from "@/utils/http";
import type { Result } from "@/api/types";

// 站点配置信息
export const getUserSiteConfigApi = (data?: object) => {
  return http.request<Result>("get", "/api/system/user/config/site", {
    params: data
  });
};

export const updateUserSiteConfigApi = (data?: object) => {
  return http.request<Result>("put", "/api/system/user/config/site", {
    data: data
  });
};
