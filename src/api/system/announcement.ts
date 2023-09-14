import { http } from "@/utils/http";
import { Result } from "@/api/types";

export const getAnnouncementListApi = (data?: object) => {
  return http.request<Result>("get", "/api/system/announcement", {
    params: data
  });
};

export const createAnnouncementApi = (data?: object) => {
  return http.request<Result>("post", "/api/system/announcement", {
    data: data
  });
};

export const deleteAnnouncementApi = (pk?: number) => {
  return http.request<Result>("delete", `/api/system/announcement/${pk}`);
};

export const updateAnnouncementApi = (pk?: number, data?: object) => {
  return http.request<Result>("put", `/api/system/announcement/${pk}`, {
    data: data,
    params: { pk: pk }
  });
};

export const manyDeleteAnnouncementApi = (data?: object) => {
  return http.request<Result>(
    "delete",
    `/api/system/announcement/many_delete`,
    {
      params: data
    }
  );
};

export const updateAnnouncementPublishApi = (pk?: number, data?: object) => {
  return http.request<Result>("put", `/api/system/announcement/${pk}/publish`, {
    data: data,
    params: { pk: pk }
  });
};

// read user announcement

export const getAnnouncementReadListApi = (data?: object) => {
  return http.request<Result>("get", "/api/system/read/announcement", {
    params: data
  });
};

export const deleteAnnouncementReadApi = (pk?: number) => {
  return http.request<Result>("delete", `/api/system/read/announcement/${pk}`);
};

export const manyDeleteAnnouncementReadApi = (data?: object) => {
  return http.request<Result>(
    "delete",
    `/api/system/read/announcement/many_delete`,
    {
      params: data
    }
  );
};
