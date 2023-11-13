import { http } from "@/utils/http";
import type { Result, ResultDetail } from "@/api/types";
import type { UserInfoResult } from "@/api/auth";

export const getUserInfoApi = () => {
  return http.request<UserInfoResult>("get", "/api/system/userinfo/self");
};

export const updateUserInfoApi = (data?: object) => {
  return http.request<ResultDetail>("put", `/api/system/userinfo/self`, {
    data: data
  });
};

export const uploadUserInfoAvatarApi = (params?: object, data?: object) => {
  return http.upload<Result>("/api/system/userinfo/upload", params, data);
};

export const updateUserInfoPasswordApi = (data?: object) => {
  return http.request<Result>("post", "/api/system/userinfo/reset_password", {
    data: data
  });
};
