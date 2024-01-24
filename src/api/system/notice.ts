import { http } from "@/utils/http";
import type { Result } from "@/api/types";

export const getNoticeListApi = (data?: object) => {
  return http.request<Result>("get", "/api/system/message/notice", {
    params: data
  });
};

export const createNoticeApi = (data?: object) => {
  return http.request<Result>("post", "/api/system/message/notice", {
    data: data
  });
};

export const createAnnouncementApi = (data?: object) => {
  return http.request<Result>(
    "post",
    "/api/system/message/notice/announcement",
    {
      data: data
    }
  );
};

export const deleteNoticeApi = (pk?: number) => {
  return http.request<Result>("delete", `/api/system/message/notice/${pk}`);
};

export const updateNoticeApi = (pk?: number, data?: object) => {
  return http.request<Result>("put", `/api/system/message/notice/${pk}`, {
    data: data
  });
};

export const manyDeleteNoticeApi = (data?: object) => {
  return http.request<Result>(
    "delete",
    `/api/system/message/notice/many-delete`,
    {
      params: data
    }
  );
};

export const updateNoticePublishApi = (pk?: number, data?: object) => {
  return http.request<Result>(
    "put",
    `/api/system/message/notice/${pk}/publish`,
    {
      data: data
    }
  );
};

// 用户已读公告查询
export const getNoticeReadListApi = (data?: object) => {
  return http.request<Result>("get", "/api/system/message/read", {
    params: data
  });
};

export const updateNoticeReadStateApi = (pk?: number, data?: object) => {
  return http.request<Result>("put", `/api/system/message/read/${pk}/state`, {
    data: data
  });
};

export const deleteNoticeReadApi = (pk?: number) => {
  return http.request<Result>("delete", `/api/system/message/read/${pk}`);
};

export const manyDeleteNoticeReadApi = (data?: object) => {
  return http.request<Result>(
    "delete",
    `/api/system/message/read/many-delete`,
    {
      params: data
    }
  );
};

// 自己未读消息通知
export const getUserNoticeUnreadListApi = (data?: object) => {
  return http.request<Result>("get", "/api/system/notice/unread", {
    params: data
  });
};

export const updateUserNoticeReadApi = (data?: object) => {
  return http.request<Result>("put", "/api/system/notice/read", {
    data: data
  });
};

export const updateUserNoticeReadAllApi = (data?: object) => {
  return http.request<Result>("put", "/api/system/notice/read_all", {
    data: data
  });
};

export const getUserNoticeListApi = (data?: object) => {
  return http.request<Result>("get", "/api/system/notice", {
    params: data
  });
};

export const deleteUserNoticeApi = (pk?: number) => {
  return http.request<Result>("delete", `/api/system/notice/${pk}`);
};
export const manyDeleteUserNoticeApi = (data?: object) => {
  return http.request<Result>("delete", `/api/system/notice/many-delete`, {
    params: data
  });
};
