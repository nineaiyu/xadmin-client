import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { createDashboardState } from "./dashboardState";
import { createDashboardFetchers } from "./dashboardFetchers";

export type { ChartCardItem, UserActiveCardItem } from "./dashboardState";

/**
 * 首页数据装配：状态容器（三张统计卡的固定槽位）见 dashboardState.ts，
 * 各卡片取数见 dashboardFetchers.ts。
 */
export function useDashboard() {
  const { t } = useI18n();

  const optionsBasis = computed(() => {
    return [
      {
        label: t("login.register")
      },
      {
        label: t("login.login")
      }
    ];
  });

  const state = createDashboardState(t);
  const fetchers = createDashboardFetchers({ t, state });

  // 首页各卡片独立取数：单个请求失败只缺对应卡片（提示由 http 层统一给出），不阻断其余卡片
  onMounted(() => {
    fetchers.getUserTotal();
    fetchers.getUserLoginList();
    fetchers.getUserLoginTotal();
    fetchers.getTodayOperateTotal();
    fetchers.getUserActiveList();
    fetchers.getUserRegisterList();
    // 操作日志时间线与统计接口互不依赖：独立发起，不随 today-operate-total 的成败与耗时联动
    if (hasAuth("list:SystemOperationLog")) {
      fetchers.getOperateLogList();
    }
  });

  return {
    t,
    chartData: state.chartData,
    optionsBasis,
    userLoginList: state.userLoginList,
    userActiveList: state.userActiveList,
    operateLogList: state.operateLogList,
    userRegisterList: state.userRegisterList
  };
}
