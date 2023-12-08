import { http } from "@/utils/http";
import type { Result } from "@/api/types";
import type { ResultDetail } from "@/api/types";

/** 扫码添加阿里云盘 */
export const getDriveQrcodeApi = (data?: object) => {
  return http.request<Result>("get", "/api/movies/qrcode-drive", {
    params: data
  });
};

export const checkDriveQrcodeStatusApi = (data?: object) => {
  return http.request<Result>("post", "/api/movies/qrcode-drive", {
    data: data
  });
};

/** 获取阿里云存储列表 */
export const getDriveListApi = (data?: object) => {
  return http.request<Result>("get", "/api/movies/drive", {
    params: data
  });
};

export const updateDriveApi = (pk?: string, data?: object) => {
  return http.request<ResultDetail>("put", `/api/movies/drive/${pk}`, {
    data: data
  });
};

export const deleteDriveApi = (pk?: string) => {
  return http.request<Result>("delete", `/api/movies/drive/${pk}`);
};

export const cleanDriveApi = (pk?: string) => {
  return http.request<Result>("post", `/api/movies/drive/${pk}/clean`);
};

export const manyDeleteDriveApi = (data?: object) => {
  return http.request<Result>("delete", `/api/movies/drive/many-delete`, {
    params: data
  });
};

export const getFileInfoByDriveApi = (pk?: string, params?: object) => {
  return http.request<Result>("get", `/api/movies/drive/${pk}/get_files`, {
    params
  });
};

export const importFileInfoByDriveApi = (pk?: string, data?: object) => {
  return http.request<Result>("post", `/api/movies/drive/${pk}/import_files`, {
    data
  });
};
