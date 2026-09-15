import { http } from "@/utils/http";
import type { DataListResult } from "@/api/types";

export interface DashboardTrendItem {
  day?: string;
  count?: number;
  [key: string]: unknown;
}

type DashBoardResult = {
  code: number;
  detail: string;
  percent: number;
  count: number;
  results?: Array<DashboardTrendItem>;
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
  return http.request<DataListResult<DashboardTrendItem>>(
    "get",
    "/api/system/dashboard/user-registered-trend",
    {
      params: params
    }
  );
};

export const getDashBoardUserLoginTrendApi = (params?: object) => {
  return http.request<DataListResult<DashboardTrendItem>>(
    "get",
    "/api/system/dashboard/user-login-trend",
    {
      params: params
    }
  );
};

export const getDashBoardUserActiveApi = (params?: object) => {
  // 行结构为 [天数, 注册数, 活跃数] 的数字数组
  return http.request<DataListResult<number[]>>(
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
