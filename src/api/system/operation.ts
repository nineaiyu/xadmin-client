import { http } from "@/utils/http";
import type { Result } from "@/api/types";

export const getOperationLogListApi = (data?: object) => {
  return http.request<Result>("get", "/api/system/operation-log", {
    params: data
  });
};

export const deleteOperationLogApi = (pk?: number) => {
  return http.request<Result>("delete", `/api/system/operation-log/${pk}`);
};

export const manyDeleteOperationLogApi = (data?: object) => {
  return http.request<Result>(
    "delete",
    `/api/system/operation-log/many-delete`,
    {
      params: data
    }
  );
};
