import { http } from "@/utils/http";
import { Result } from "@/api/types";

export const getNoticeUnreadListApi = (data?: object) => {
  return http.request<Result>("get", "/api/system/notice/unread", {
    params: data
  });
};

export const updateNoticeReadApi = (data?: object) => {
  return http.request<Result>("put", "/api/system/notice/read", {
    data: data
  });
};

export const getAnnouncementUnreadListApi = (data?: object) => {
  return http.request<Result>("get", "/api/system/announce/unread", {
    params: data
  });
};

export const updateAnnouncementReadApi = (data?: object) => {
  return http.request<Result>("put", "/api/system/announce/read", {
    data: data
  });
};
