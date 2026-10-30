import { isSuccess } from "@/api/types";
import {
  getDashBoardUserTotalApi,
  getDashBoardUserActiveApi,
  getDashBoardUserLoginTotalApi,
  getDashBoardUserLoginTrendApi,
  getDashBoardUserRegisterTrendApi,
  getDashBoardTodayOperateTotalApi
} from "@/api/system/dashboard";
import { operationLogApi } from "@/api/audit/logs/operation";
import { aiAssistantApi } from "@/api/ai/ai";
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
  /** 数据权限无授权时后端带 scope_limited：聚合一次，页面顶部统一提示 */
  const markScopeLimited = (res: { scope_limited?: boolean }) => {
    if (res.scope_limited) state.scopeLimited.value = true;
  };

  const getUserActiveList = () => {
    return getDashBoardUserActiveApi()
      .then(res => {
        if (isSuccess(res)) {
          markScopeLimited(res);
          // 重新加载时先清空，避免重复追加历史卡片
          state.userActiveList.value = [];
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
      .catch(() => {
        state.loadFailed.value = true;
      });
  };

  const getTodayOperateTotal = () => {
    return getDashBoardTodayOperateTotalApi()
      .then(res => {
        if (isSuccess(res)) {
          markScopeLimited(res);
          const results = res.results ?? [];
          // 取趋势窗口最后一天（今天）的计数；空结果兜底 0
          const counts = getKeyList(results, "count", false);
          state.chartData.value[0] = {
            ...state.chartData.value[0],
            value: counts.length ? counts[counts.length - 1] : 0,
            percent: res.percent > 0 ? `+${res.percent}%` : `${res.percent}%`,
            data: getKeyList(results, "count", false)
          };
        }
      })
      .catch(() => {
        state.loadFailed.value = true;
      });
  };

  const getUserTotal = () => {
    return getDashBoardUserTotalApi()
      .then(res => {
        if (isSuccess(res)) {
          markScopeLimited(res);
          const results = res.results ?? [];
          state.chartData.value[1] = {
            ...state.chartData.value[1],
            value: res.count,
            percent: res.percent > 0 ? `+${res.percent}%` : `${res.percent}%`,
            data: getKeyList(results, "count", false)
          };
        }
      })
      .catch(() => {
        state.loadFailed.value = true;
      });
  };

  const getUserLoginTotal = () => {
    return getDashBoardUserLoginTotalApi()
      .then(res => {
        if (isSuccess(res)) {
          markScopeLimited(res);
          const results = res.results ?? [];
          state.chartData.value[2] = {
            ...state.chartData.value[2],
            value: res.count,
            percent: res.percent > 0 ? `+${res.percent}%` : `${res.percent}%`,
            data: getKeyList(results, "count", false)
          };
        }
      })
      .catch(() => {
        state.loadFailed.value = true;
      });
  };

  const getUserLoginList = () => {
    return getDashBoardUserLoginTrendApi()
      .then(res => {
        if (isSuccess(res)) {
          markScopeLimited(res);
          state.userLoginList.value = res.data;
        }
      })
      .catch(() => {
        state.loadFailed.value = true;
      });
  };

  const getUserRegisterList = () => {
    return getDashBoardUserRegisterTrendApi()
      .then(res => {
        if (isSuccess(res)) {
          markScopeLimited(res);
          state.userRegisterList.value = res.data;
        }
      })
      .catch(() => {
        state.loadFailed.value = true;
      });
  };

  const getOperateLogList = () => {
    return operationLogApi
      .list({
        page: 1,
        size: 20,
        ordering: "-created_time"
      })
      .then(res => {
        if (isSuccess(res)) {
          state.operateLogList.value = res.data?.results ?? [];
        }
      })
      .catch(() => {
        state.loadFailed.value = true;
      });
  };

  /**
   * AI 日报卡：开关关闭时后端只回 enabled=false（卡不渲染）。失败静默——
   * 该卡是增强项，不计入 loadFailed（普通用户无 AI 权限时请求根本不发，
   * 见 hook.tsx 的 hasAuth 门）。
   */
  const getDailyReport = () => {
    return aiAssistantApi
      .dailyReport()
      .then(res => {
        if (isSuccess(res) && res.data?.enabled) {
          state.dailyReport.value = res.data;
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
    getOperateLogList,
    getDailyReport
  };
}
