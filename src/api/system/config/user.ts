import { http } from "@/utils/http";
import type { Result } from "@/api/types";

export const getUserConfigListApi = (data?: object) => {
  return http.request<Result>("get", "/api/system/config/user", {
    params: data
  });
};

export const createUserConfigApi = (data?: object) => {
  return http.request<Result>("post", "/api/system/config/user", {
    data: data
  });
};

export const deleteUserConfigApi = (pk?: number) => {
  return http.request<Result>("delete", `/api/system/config/user/${pk}`);
};

export const updateUserConfigApi = (pk?: number, data?: object) => {
  return http.request<Result>("put", `/api/system/config/user/${pk}`, {
    data: data
  });
};

export const manyDeleteUserConfigApi = (data?: object) => {
  return http.request<Result>("delete", `/api/system/config/user/many-delete`, {
    params: data
  });
};

export const actionInvalidCacheApi = (pk?: number) => {
  return http.request<Result>("post", `/api/system/config/user/${pk}/invalid`);
};
