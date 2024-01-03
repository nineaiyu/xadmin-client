import { http } from "@/utils/http";
import type { Result } from "@/api/types";

export const getOperationLogListApi = (data?: object) => {
  return http.request<Result>("get", "/api/system/logs/operation", {
    params: data
  });
};

export const deleteOperationLogApi = (pk?: number) => {
  return http.request<Result>("delete", `/api/system/logs/operation/${pk}`);
};

export const manyDeleteOperationLogApi = (data?: object) => {
  return http.request<Result>(
    "delete",
    `/api/system/logs/operation/many-delete`,
    {
      params: data
    }
  );
};
