import { http } from "@/utils/http";
import type { Result } from "@/api/types";

export const getSystemConfigListApi = (data?: object) => {
  return http.request<Result>("get", "/api/system/config/system", {
    params: data
  });
};

export const createSystemConfigApi = (data?: object) => {
  return http.request<Result>("post", "/api/system/config/system", {
    data: data
  });
};

export const deleteSystemConfigApi = (pk?: number) => {
  return http.request<Result>("delete", `/api/system/config/system/${pk}`);
};

export const updateSystemConfigApi = (pk?: number, data?: object) => {
  return http.request<Result>("put", `/api/system/config/system/${pk}`, {
    data: data
  });
};

export const manyDeleteSystemConfigApi = (data?: object) => {
  return http.request<Result>(
    "delete",
    `/api/system/config/system/many-delete`,
    {
      params: data
    }
  );
};

export const actionInvalidCacheApi = (pk?: number) => {
  return http.request<Result>(
    "post",
    `/api/system/config/system/${pk}/invalid`
  );
};
