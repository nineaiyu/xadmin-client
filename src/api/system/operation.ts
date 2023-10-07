import { http } from "@/utils/http";
import { Result } from "@/api/types";

export const getOperationLogListApi = (data?: object) => {
  return http.request<Result>("get", "/api/system/operation-log", {
    params: data
  });
};

export const createOperationLogApi = (data?: object) => {
  return http.request<Result>("post", "/api/system/operation-log", {
    data: data
  });
};

export const deleteOperationLogApi = (pk?: number) => {
  return http.request<Result>("delete", `/api/system/operation-log/${pk}`);
};

export const updateOperationLogApi = (pk?: number, data?: object) => {
  return http.request<Result>("put", `/api/system/operation-log/${pk}`, {
    data: data,
    params: { pk: pk }
  });
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
