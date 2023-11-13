import { http } from "@/utils/http";
import type { Result, ResultDetail } from "@/api/types";

/** 获取用户管理列表 */
export const getUserListApi = (data?: object) => {
  return http.request<Result>("get", "/api/system/user", { params: data });
};

export const createUserApi = (data?: object) => {
  return http.request<ResultDetail>("post", "/api/system/user", { data: data });
};

export const deleteUserApi = (pk?: number) => {
  return http.request<Result>("delete", `/api/system/user/${pk}`);
};

export const updateUserApi = (pk?: number, data?: object) => {
  return http.request<ResultDetail>("put", `/api/system/user/${pk}`, {
    data: data
  });
};

export const manyDeleteUserApi = (data?: object) => {
  return http.request<Result>("delete", `/api/system/user/many-delete`, {
    params: data
  });
};

export const uploadUserAvatarApi = (params?: object, data?: object) => {
  return http.upload<Result>("/api/system/user/upload", params, data);
};

export const updateUserPasswordApi = (data?: object) => {
  return http.request<Result>("post", "/api/system/user/reset_password", {
    data: data
  });
};
