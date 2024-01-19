import { http } from "@/utils/http";
import type { Result, ResultDetail } from "@/api/types";

/** 获取电影播放记录 */
export const getWatchHistoryListApi = (data?: object) => {
  return http.request<Result>("get", "/api/movies/history", {
    params: data
  });
};

export const createWatchHistoryApi = (data?: object) => {
  return http.request<Result>("post", "/api/movies/history", {
    data: data
  });
};

export const updateWatchHistoryApi = (pk?: string, data?: object) => {
  return http.request<ResultDetail>("put", `/api/movies/history/${pk}`, {
    data: data
  });
};

export const deleteWatchHistoryApi = (pk?: string) => {
  return http.request<Result>("delete", `/api/movies/history/${pk}`);
};

export const manyDeleteWatchHistoryApi = (data?: object) => {
  return http.request<Result>("delete", `/api/movies/history/many-delete`, {
    params: data
  });
};

export const updateWatchHistoryTimesApi = (data?: object) => {
  return http.request<Result>("post", "/api/movies/history/times", {
    data: data
  });
};
