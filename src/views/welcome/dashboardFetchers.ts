import { SUCCESS_CODE } from "@/api/types";
import {
  getDashBoardUserTotalApi,
  getDashBoardUserActiveApi,
  getDashBoardUserLoginTotalApi,
  getDashBoardUserLoginTrendApi,
  getDashBoardUserRegisterTrendApi,
  getDashBoardTodayOperateTotalApi
} from "@/api/system/dashboard";
import { operationLogApi } from "@/api/audit/logs/operation";
import { getKeyList } from "@pureadmin/utils";
import type { DashboardState } from "./dashboardState";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 首页各卡片取数（自 hook.tsx 抽出）：各请求独立发起，单个失败只缺对应卡片
 * （提示由 http 层统一给出），不阻断其余卡片。
 */
export function createDashboardFetchers({
  t,
  state
}: {
  t: TFunction;
  state: DashboardState;
}) {
  const getUserActiveList = () => {
    getDashBoardUserActiveApi()
      .then(res => {
        if (res.code === SUCCESS_CODE) {
          res.data.forEach(item => {
            state.userActiveList.value.push({
              name:
                item[0] === 1
                  ? t("welcome.today")
                  : `${item[0]}${t("welcome.days")}`,
              value: item,
              duration: 2200
            });
          });
        }
      })
      .catch(() => undefined);
  };

  const getTodayOperateTotal = () => {
    getDashBoardTodayOperateTotalApi()
      .then(res => {
        if (res.code === SUCCESS_CODE) {
          const results = res.results ?? [];
          // 空结果时按天取数的下标越界，value 兜底 0
          state.chartData.value[0] = {
            ...state.chartData.value[0],
            value: results.length
              ? getKeyList(results, "count", false)[results.length - 1]
              : 0,
            percent: res.percent > 0 ? `+${res.percent}%` : `${res.percent}%`,
            data: getKeyList(results, "count", false)
          };
        }
      })
      .catch(() => undefined);
  };

  const getUserTotal = () => {
    getDashBoardUserTotalApi()
      .then(res => {
        if (res.code === SUCCESS_CODE) {
          const results = res.results ?? [];
          state.chartData.value[1] = {
            ...state.chartData.value[1],
            value: res.count,
            percent: res.percent > 0 ? `+${res.percent}%` : `${res.percent}%`,
            data: getKeyList(results, "count", false)
          };
        }
      })
      .catch(() => undefined);
  };

  const getUserLoginTotal = () => {
    getDashBoardUserLoginTotalApi()
      .then(res => {
        if (res.code === SUCCESS_CODE) {
          const results = res.results ?? [];
          state.chartData.value[2] = {
            ...state.chartData.value[2],
            value: res.count,
            percent: res.percent > 0 ? `+${res.percent}%` : `${res.percent}%`,
            data: getKeyList(results, "count", false)
          };
        }
      })
      .catch(() => undefined);
  };

  const getUserLoginList = () => {
    getDashBoardUserLoginTrendApi()
      .then(res => {
        if (res.code === SUCCESS_CODE) {
          state.userLoginList.value = res.data;
        }
      })
      .catch(() => undefined);
  };

  const getUserRegisterList = () => {
    getDashBoardUserRegisterTrendApi()
      .then(res => {
        if (res.code === SUCCESS_CODE) {
          state.userRegisterList.value = res.data;
        }
      })
      .catch(() => undefined);
  };

  const getOperateLogList = () => {
    operationLogApi
      .list({
        page: 1,
        size: 20,
        ordering: "-created_time"
      })
      .then(res => {
        if (res.code === SUCCESS_CODE) {
          state.operateLogList.value = res.data?.results ?? [];
        }
      })
      .catch(() => undefined);
  };

  return {
    getUserActiveList,
    getTodayOperateTotal,
    getUserTotal,
    getUserLoginTotal,
    getUserLoginList,
    getUserRegisterList,
    getOperateLogList
  };
}
