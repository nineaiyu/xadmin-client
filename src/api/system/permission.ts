import { http } from "@/utils/http";
import type { Result, ResultDetail } from "@/api/types";

/** 获取用户管理列表 */
export const getDataPermissionListApi = (data?: object) => {
  return http.request<Result>("get", "/api/system/permission", {
    params: data
  });
};

export const createDataPermissionApi = (data?: object) => {
  return http.request<ResultDetail>("post", "/api/system/permission", {
    data: data
  });
};

export const deleteDataPermissionApi = (pk?: number) => {
  return http.request<Result>("delete", `/api/system/permission/${pk}`);
};

export const updateDataPermissionApi = (pk?: number, data?: object) => {
  return http.request<ResultDetail>("put", `/api/system/permission/${pk}`, {
    data: data
  });
};

export const manyDeleteDataPermissionApi = (data?: object) => {
  return http.request<Result>("delete", `/api/system/permission/many-delete`, {
    params: data
  });
};
