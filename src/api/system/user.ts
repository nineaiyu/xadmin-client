import { http } from "@/utils/http";
import { Result, ResultDetail } from "@/api/types";

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
  return http.request<Result>("delete", `/api/system/user/many_delete`, {
    params: data
  });
};

export const uploadUserAvatarApi = (params?: object, data?: object) => {
  return http.upload<Result>("/api/system/upload", params, data);
};
