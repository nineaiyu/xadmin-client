import { http } from "@/utils/http";
import type { Result, ResultDetail } from "@/api/types";

export const getRoleListApi = (data?: object) => {
  return http.request<Result>("get", "/api/system/role", { params: data });
};

export const getRoleDetailApi = (pk?: number) => {
  return http.request<ResultDetail>("get", `/api/system/role/${pk}`);
};

export const createRoleApi = (data?: object) => {
  return http.request<Result>("post", "/api/system/role", { data: data });
};

export const deleteRoleApi = (pk?: number) => {
  return http.request<Result>("delete", `/api/system/role/${pk}`);
};

export const updateRoleApi = (pk?: number, data?: object) => {
  return http.request<Result>("put", `/api/system/role/${pk}`, {
    data: data
  });
};

export const manyDeleteRoleApi = (data?: object) => {
  return http.request<Result>("delete", `/api/system/role/many-delete`, {
    params: data
  });
};
