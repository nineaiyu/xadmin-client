import { http } from "@/utils/http";
import type { Result } from "@/api/types";
import type { UserInfoResult } from "@/api/auth";

const site = "WEB_SITE_CONFIG";
// 站点配置信息
export const getUserSiteConfigApi = (data?: object) => {
  return http.request<UserInfoResult>("get", `/api/system/configs/${site}`, {
    params: data
  });
};

export const updateUserSiteConfigApi = (data?: object) => {
  return http.request<Result>("put", `/api/system/configs/${site}`, {
    data: data
  });
};
