import { http } from "@/utils/http";
import { Result } from "@/api/types";

export const getNotifyListApi = (data?: object) => {
  return http.request<Result>("get", "/api/system/notify", { params: data });
};

export const createNotifyApi = (data?: object) => {
  return http.request<Result>("post", "/api/system/notify", { data: data });
};

export const deleteNotifyApi = (pk?: number) => {
  return http.request<Result>("delete", `/api/system/notify/${pk}`);
};

export const updateNotifyApi = (pk?: number, data?: object) => {
  return http.request<Result>("put", `/api/system/notify/${pk}`, {
    data: data,
    params: { pk: pk }
  });
};

export const manyDeleteNotifyApi = (data?: object) => {
  return http.request<Result>("delete", `/api/system/notify/many_delete`, {
    params: data
  });
};

export const updateNotifyPublishApi = (pk?: number, data?: object) => {
  return http.request<Result>("put", `/api/system/notify/${pk}/publish`, {
    data: data,
    params: { pk: pk }
  });
};
