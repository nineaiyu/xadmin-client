import { http } from "@/utils/http";
import type { Result } from "@/api/types";

// 自己未读消息通知
export const getUserNoticeUnreadListApi = (data?: object) => {
  return http.request<Result>("get", "/api/system/user/notice/unread", {
    params: data
  });
};

export const updateUserNoticeReadApi = (data?: object) => {
  return http.request<Result>("put", "/api/system/user/notice/read", {
    data: data
  });
};

export const updateUserNoticeReadAllApi = (data?: object) => {
  return http.request<Result>("put", "/api/system/user/notice/read_all", {
    data: data
  });
};

export const getUserNoticeListApi = (data?: object) => {
  return http.request<Result>("get", "/api/system/user/notice", {
    params: data
  });
};
