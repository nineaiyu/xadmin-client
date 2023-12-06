import { http } from "@/utils/http";
import type { Result } from "@/api/types";
import type { ResultDetail } from "@/api/types";

/** 获取电影每集列表 */
export const getEpisodeListApi = (data?: object) => {
  return http.request<Result>("get", "/api/movies/episode", {
    params: data
  });
};

export const createEpisodeApi = (data?: object) => {
  return http.request<Result>("post", "/api/movies/episode", {
    data: data
  });
};

export const updateEpisodeApi = (pk?: string, data?: object) => {
  return http.request<ResultDetail>("put", `/api/movies/episode/${pk}`, {
    data: data
  });
};

export const deleteEpisodeApi = (pk?: string) => {
  return http.request<Result>("delete", `/api/movies/episode/${pk}`);
};

export const manyDeleteEpisodeApi = (data?: object) => {
  return http.request<Result>("delete", `/api/movies/episode/many-delete`, {
    params: data
  });
};

export const actionRankEpisodeApi = (params?: object, data?: object) => {
  return http.request<Result>("post", `/api/movies/episode/action_rank`, {
    params: params,
    data: data
  });
};
