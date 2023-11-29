import { http } from "@/utils/http";
import type { Result } from "@/api/types";
import type { ResultDetail } from "@/api/types";

/** 获取电影类别 */
export const getCategoryListApi = (data?: object) => {
  return http.request<Result>("get", "/api/movies/category", {
    params: data
  });
};

export const createCategoryApi = (data?: object) => {
  return http.request<Result>("post", "/api/movies/category", {
    data: data
  });
};

export const updateCategoryApi = (pk?: string, data?: object) => {
  return http.request<ResultDetail>("put", `/api/movies/category/${pk}`, {
    data: data
  });
};

export const deleteCategoryApi = (pk?: string) => {
  return http.request<Result>("delete", `/api/movies/category/${pk}`);
};

export const manyDeleteCategoryApi = (data?: object) => {
  return http.request<Result>("delete", `/api/movies/category/many-delete`, {
    params: data
  });
};
