import { http } from "@/utils/http";
import type { Result, ResultDetail } from "@/api/types";

export const getActorListApi = (data?: object) => {
  return http.request<Result>("get", "/api/movies/actor", {
    params: data
  });
};

export const createActorApi = (data?: object) => {
  return http.request<Result>("post", "/api/movies/actor", {
    data: data
  });
};

export const updateActorApi = (pk?: string, data?: object) => {
  return http.request<ResultDetail>("put", `/api/movies/actor/${pk}`, {
    data: data
  });
};

export const deleteActorApi = (pk?: string) => {
  return http.request<Result>("delete", `/api/movies/actor/${pk}`);
};

export const manyDeleteActorApi = (data?: object) => {
  return http.request<Result>("delete", `/api/movies/actor/many-delete`, {
    params: data
  });
};

export const uploadFilePosterApi = (pk?: string, data?: object) => {
  return http.upload<Result>(`/api/movies/actor/${pk}/upload`, {}, data);
};
