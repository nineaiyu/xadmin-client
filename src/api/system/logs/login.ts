import { http } from "@/utils/http";
import type { Result } from "@/api/types";

export const getLoginLogListApi = (data?: object) => {
  return http.request<Result>("get", "/api/system/logs/login", {
    params: data
  });
};

export const deleteLoginLogApi = (pk?: number) => {
  return http.request<Result>("delete", `/api/system/logs/login/${pk}`);
};

export const manyDeleteLoginLogApi = (data?: object) => {
  return http.request<Result>("delete", `/api/system/logs/login/many-delete`, {
    params: data
  });
};

export const getLoginLogDetailApi = (pk?: number | string, data?: object) => {
  return http.request<Result>("get", `/api/system/logs/login/${pk}`, {
    params: data
  });
};
