import { http } from "@/utils/http";
import type { Result } from "@/api/types";

export const getModelLabelFieldListApi = (data?: object) => {
  return http.request<Result>("get", "/api/system/field", {
    params: data
  });
};

export const getModelLabelFieldLookupsListApi = (params?: object) => {
  return http.request<Result>("get", "/api/system/field/lookups", {
    params: params
  });
};

export const syncModelLabelFieldApi = (params?: object) => {
  return http.request<Result>("get", "/api/system/field/sync", {
    params: params
  });
};
