import { http } from "@/utils/http";
import { MenuDataResult, Result } from "@/api/types";

export const getMenuListApi = (data?: object) => {
  return http.request<MenuDataResult>("get", "/api/system/menu", {
    params: data
  });
};

export const createMenuApi = (data?: object) => {
  return http.request<Result>("post", "/api/system/menu", { data: data });
};

export const deleteMenuApi = (pk?: number) => {
  return http.request<Result>("delete", `/api/system/menu/${pk}`);
};

export const updateMenuApi = (pk?: number, data?: object) => {
  return http.request<Result>("put", `/api/system/menu/${pk}`, { data: data });
};

export const manyDeleteMenuApi = (data?: object) => {
  return http.request<Result>("delete", `/api/system/menu/many_delete`, {
    params: data
  });
};

export const actionRankMenuApi = (data?: object) => {
  return http.request<Result>("post", `/api/system/menu/action_rank`, {
    data: data
  });
};
