import { http } from "@/utils/http";
import type { Result } from "@/api/types";
import type { ResultDetail } from "@/api/types";

export const getSwipeListApi = (data?: object) => {
  return http.request<Result>("get", "/api/movies/swipe", {
    params: data
  });
};

export const createSwipeApi = (data?: object) => {
  return http.request<Result>("post", "/api/movies/swipe", {
    data: data
  });
};

export const updateSwipeApi = (pk?: string, data?: object) => {
  return http.request<ResultDetail>("put", `/api/movies/swipe/${pk}`, {
    data: data
  });
};

export const deleteSwipeApi = (pk?: string) => {
  return http.request<Result>("delete", `/api/movies/swipe/${pk}`);
};

export const manyDeleteSwipeApi = (data?: object) => {
  return http.request<Result>("delete", `/api/movies/swipe/many-delete`, {
    params: data
  });
};

export const uploadFilePosterApi = (pk?: string, data?: object) => {
  return http.upload<Result>(`/api/movies/swipe/${pk}/upload`, {}, data);
};

export const actionRankSwipeApi = (data?: object) => {
  return http.request<Result>("post", `/api/movies/swipe/action_rank`, {
    data: data
  });
};
