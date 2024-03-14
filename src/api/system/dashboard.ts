import { http } from "@/utils/http";
import type { Result } from "@/api/types";

export const getDashBoardUserLoginTotalApi = (params?: object) => {
  return http.request<Result>("get", "/api/system/dashboard/user-login-total", {
    params: params
  });
};

export const getDashBoardUserTotalApi = (params?: object) => {
  return http.request<Result>("get", "/api/system/dashboard/user-total", {
    params: params
  });
};

export const getDashBoardUserRegisterTrendApi = (params?: object) => {
  return http.request<Result>(
    "get",
    "/api/system/dashboard/user-registered-trend",
    {
      params: params
    }
  );
};

export const getDashBoardUserLoginTrendApi = (params?: object) => {
  return http.request<Result>("get", "/api/system/dashboard/user-login-trend", {
    params: params
  });
};

export const getDashBoardUserActiveApi = (params?: object) => {
  return http.request<Result>("get", "/api/system/dashboard/user-active", {
    params: params
  });
};

export const getDashBoardTodayOperateTotalApi = (params?: object) => {
  return http.request<Result>(
    "get",
    "/api/system/dashboard/today-operate-total",
    {
      params: params
    }
  );
};
