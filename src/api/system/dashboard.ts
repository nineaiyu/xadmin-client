import { http } from "@/utils/http";
import type { DataListResult } from "@/api/types";

type DashBoardResult = {
  code: number;
  detail: string;
  percent: number;
  count: number;
  results?: Array<any>;
};

export const getDashBoardUserLoginTotalApi = (params?: object) => {
  return http.request<DashBoardResult>(
    "get",
    "/api/system/dashboard/user-login-total",
    {
      params: params
    }
  );
};

export const getDashBoardUserTotalApi = (params?: object) => {
  return http.request<DashBoardResult>(
    "get",
    "/api/system/dashboard/user-total",
    {
      params: params
    }
  );
};

export const getDashBoardUserRegisterTrendApi = (params?: object) => {
  return http.request<DataListResult>(
    "get",
    "/api/system/dashboard/user-registered-trend",
    {
      params: params
    }
  );
};

export const getDashBoardUserLoginTrendApi = (params?: object) => {
  return http.request<DataListResult>(
    "get",
    "/api/system/dashboard/user-login-trend",
    {
      params: params
    }
  );
};

export const getDashBoardUserActiveApi = (params?: object) => {
  return http.request<DataListResult>(
    "get",
    "/api/system/dashboard/user-active",
    {
      params: params
    }
  );
};

export const getDashBoardTodayOperateTotalApi = (params?: object) => {
  return http.request<DashBoardResult>(
    "get",
    "/api/system/dashboard/today-operate-total",
    {
      params: params
    }
  );
};
