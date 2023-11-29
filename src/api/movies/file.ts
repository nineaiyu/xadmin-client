import { http } from "@/utils/http";
import type { Result } from "@/api/types";
import type { ResultDetail } from "@/api/types";

/** 阿里云盘文件管理 */
export const getFileListApi = (data?: object) => {
  return http.request<Result>("get", "/api/movies/file", {
    params: data
  });
};

export const updateFileApi = (pk?: string, data?: object) => {
  return http.request<ResultDetail>("put", `/api/movies/file/${pk}`, {
    data: data
  });
};

export const deleteFileApi = (pk?: string) => {
  return http.request<Result>("delete", `/api/movies/file/${pk}`);
};

export const manyDeleteFileApi = (data?: object) => {
  return http.request<Result>("delete", `/api/movies/file/many-delete`, {
    params: data
  });
};

export const getFileDownloadUrlApi = (pk?: string, data?: object) => {
  return http.request<ResultDetail>(
    "get",
    `/api/movies/file/${pk}/download-url`,
    {
      data: data
    }
  );
};

export const getFilePreviewUrlApi = (pk?: string, data?: object) => {
  return http.request<ResultDetail>("get", `/api/movies/file/${pk}/preview`, {
    data: data
  });
};
export const manyDownloadFileApi = (data?: object) => {
  return http.request<Result>("get", `/api/movies/file/many-download`, {
    params: data
  });
};

// 上传操作api

export const uploadGetAuthSidApi = (data?: object) => {
  return http.request<Result>("post", `/api/movies/file/auth_sid`, {
    data: data
  });
};

export const uploadPreHashApi = (data?: object) => {
  return http.request<Result>("post", `/api/movies/file/pre_hash`, {
    data: data
  });
};

export const uploadContentHashApi = (data?: object) => {
  return http.request<Result>("post", `/api/movies/file/content_hash`, {
    data: data
  });
};

export const uploadCompleteApi = (data?: object) => {
  return http.request<Result>("post", `/api/movies/file/upload_complete`, {
    data: data
  });
};

export const directDownloadUrl = `/api/movies/download/`;
