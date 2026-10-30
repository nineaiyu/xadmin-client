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

  // 首页各卡片独立取数：单个请求失败只置失败标记，不阻断其余卡片
  const reload = () => {
    state.loading.value = true;
    state.loadFailed.value = false;
    const tasks = [
      fetchers.getUserTotal(),
      fetchers.getUserLoginList(),
      fetchers.getUserLoginTotal(),
      fetchers.getTodayOperateTotal(),
      fetchers.getUserActiveList(),
      fetchers.getUserRegisterList()
    ];
    // 操作日志时间线与统计接口互不依赖：独立发起，不随 today-operate-total 的成败与耗时联动
    if (hasAuth("list:SystemOperationLog")) {
      tasks.push(fetchers.getOperateLogList());
    }
    // AI 日报卡：与助手状态同一权限点（status:AiAssistant 正则覆盖 daily-report）；
    // 未授权用户不发请求（避免 403 噪音），开关关闭时后端只回 enabled=false
    if (hasAuth("status:AiAssistant")) {
      tasks.push(fetchers.getDailyReport());
    }
    Promise.all(tasks).finally(() => {
      state.loading.value = false;
    });
  };
  onMounted(reload);

  return {
    t,
    chartData: state.chartData,
    optionsBasis,
    userLoginList: state.userLoginList,
    userActiveList: state.userActiveList,
    operateLogList: state.operateLogList,
    userRegisterList: state.userRegisterList,
    scopeLimited: state.scopeLimited,
    loading: state.loading,
    loadFailed: state.loadFailed,
    dailyReport: state.dailyReport,
    reload
  };
}
