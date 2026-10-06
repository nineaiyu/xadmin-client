import { BaseApi } from "@/api/base";
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

/** 欢迎页统计面板：六个只读统计动作（无请求体 GET，查询参数经 formatParams 收口） */
class DashboardApi extends BaseApi {
  userLoginTotal = (params?: object) => {
    return this.request<DashBoardResult>(
      "get",
      params,
      undefined,
      `${this.baseApi}/user-login-total`
    );
  };

  userTotal = (params?: object) => {
    return this.request<DashBoardResult>(
      "get",
      params,
      undefined,
      `${this.baseApi}/user-total`
    );
  };

  userRegisterTrend = (params?: object) => {
    return this.request<DataListResult<DashboardTrendItem>>(
      "get",
      params,
      undefined,
      `${this.baseApi}/user-registered-trend`
    );
  };

  userLoginTrend = (params?: object) => {
    return this.request<DataListResult<DashboardTrendItem>>(
      "get",
      params,
      undefined,
      `${this.baseApi}/user-login-trend`
    );
  };

  /** 行结构为 [天数, 注册数, 活跃数] 的数字数组 */
  userActive = (params?: object) => {
    return this.request<DataListResult<number[]>>(
      "get",
      params,
      undefined,
      `${this.baseApi}/user-active`
    );
  };

  todayOperateTotal = (params?: object) => {
    return this.request<DashBoardResult>(
      "get",
      params,
      undefined,
      `${this.baseApi}/today-operate-total`
    );
  };
}

export const systemDashboardApi = new DashboardApi("/api/system/dashboard");

/* ---------------- 既有命名导出改薄委托：消费方依赖这些函数名，签名与返回类型不变 ---------------- */

export const getDashBoardUserLoginTotalApi = (params?: object) =>
  systemDashboardApi.userLoginTotal(params);

export const getDashBoardUserTotalApi = (params?: object) =>
  systemDashboardApi.userTotal(params);

export const getDashBoardUserRegisterTrendApi = (params?: object) =>
  systemDashboardApi.userRegisterTrend(params);

export const getDashBoardUserLoginTrendApi = (params?: object) =>
  systemDashboardApi.userLoginTrend(params);

export const getDashBoardUserActiveApi = (params?: object) =>
  systemDashboardApi.userActive(params);

export const getDashBoardTodayOperateTotalApi = (params?: object) =>
  systemDashboardApi.todayOperateTotal(params);
