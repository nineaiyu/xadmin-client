import { http } from "@/utils/http";
import type { Result, ResultDetail } from "@/api/types";

/** 获取用户管理列表 */
export const getDeptListApi = (data?: object) => {
  return http.request<Result>("get", "/api/system/dept", { params: data });
};

export const createDeptApi = (data?: object) => {
  return http.request<ResultDetail>("post", "/api/system/dept", {
    data: data
  });
};

export const deleteDeptApi = (pk?: number) => {
  return http.request<Result>("delete", `/api/system/dept/${pk}`);
};

export const updateDeptApi = (pk?: number, data?: object) => {
  return http.request<ResultDetail>("put", `/api/system/dept/${pk}`, {
    data: data
  });
};

export const manyDeleteDeptApi = (data?: object) => {
  return http.request<Result>("delete", `/api/system/dept/many-delete`, {
    params: data
  });
};

export const actionRankDeptApi = (data?: object) => {
  return http.request<Result>("post", `/api/system/dept/action_rank`, {
    data: data
  });
};

export const empowerDeptRoleApi = (pk?: number, data?: object) => {
  return http.request<Result>("post", `/api/system/dept/${pk}/empower`, {
    data: data
  });
};

export const getDeptDetailApi = (pk?: number | string, data?: object) => {
  return http.request<Result>("get", `/api/system/dept/${pk}`, {
    params: data
  });
};
