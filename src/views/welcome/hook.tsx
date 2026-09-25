import { SUCCESS_CODE } from "@/api/types";
import {
  getDashBoardUserTotalApi,
  getDashBoardUserActiveApi,
  getDashBoardUserLoginTotalApi,
  getDashBoardUserLoginTrendApi,
  getDashBoardUserRegisterTrendApi,
  getDashBoardTodayOperateTotalApi,
  type DashboardTrendItem
} from "@/api/system/dashboard";
import { useI18n } from "vue-i18n";
import LoginLine from "~icons/ep/lock";
import LogLine from "~icons/ep/tickets";
import { hasAuth } from "@/router/utils";
import GroupLine from "~icons/ri/group-line";
import { getKeyList } from "@pureadmin/utils";
import { computed, onMounted, ref, type Component } from "vue";
import { operationLogApi } from "@/api/system/logs/operation";
import type { EpColorName } from "@/utils/chartTheme";
import type { RecordType } from "plus-pro-components";

/** 顶部指标卡片（chartData）：配色只声明 EP 语义色名，具体色值渲染期按主题解析 */
export type ChartCardItem = {
  icon: Component;
  tone: EpColorName;
  duration: number;
  name: string;
  value: number;
  /** 环比百分比文案（形如 +12%） */
  percent: string;
  /** 折线趋势数据 */
  data: number[];
};

/** 活跃用户卡片（userActiveList，value 为 [天数, 注册数, 活跃数]） */
export type UserActiveCardItem = {
  name: string;
  value: number[];
  duration: number;
};

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
  const dataList = ref([]);
  const loading = ref(true);

  const chartData = ref<ChartCardItem[]>([]);
  const userLoginList = ref<DashboardTrendItem[]>([]);
  const userRegisterList = ref<DashboardTrendItem[]>([]);
  const operateLogList = ref<RecordType[]>([]);
  const userActiveList = ref<UserActiveCardItem[]>([]);

  const getUserActiveList = () => {
    getDashBoardUserActiveApi().then(res => {
      if (res.code === SUCCESS_CODE) {
        res.data.forEach(item => {
          userActiveList.value.push({
            name:
              item[0] === 1
                ? t("welcome.today")
                : `${item[0]}${t("welcome.days")}`,
            value: item,
            duration: 2200
          });
        });
      }
    });
  };

  const getTodayOperateTotal = () => {
    getDashBoardTodayOperateTotalApi().then(res => {
      if (hasAuth("list:SystemOperationLog")) {
        getOperateLogList();
      }
      if (res.code === SUCCESS_CODE) {
        // results 为可选字段，缺失时按空数组处理
        const results = res.results ?? [];
        chartData.value.push({
          icon: LogLine,
          tone: "warning",
          duration: 2200,
          name: t("welcome.requestNum"),
          value: getKeyList(results, "count", false)[results.length - 1],
          percent: res.percent > 0 ? `+${res.percent}%` : `${res.percent}%`,
          data: getKeyList(results, "count", false)
        });
      }
    });
  };
  const getUserTotal = () => {
    getDashBoardUserTotalApi().then(res => {
      if (res.code === SUCCESS_CODE) {
        const results = res.results ?? [];
        chartData.value.push({
          icon: GroupLine,
          tone: "success",
          duration: 2200,
          name: t("welcome.userNum"),
          value: res.count,
          percent: res.percent > 0 ? `+${res.percent}%` : `${res.percent}%`,
          data: getKeyList(results, "count", false)
        });
      }
    });
  };
  const getUserLoginTotal = () => {
    getDashBoardUserLoginTotalApi().then(res => {
      if (res.code === SUCCESS_CODE) {
        const results = res.results ?? [];
        chartData.value.push({
          icon: LoginLine,
          tone: "primary",
          duration: 2200,
          name: t("welcome.loginTimes"),
          value: res.count,
          percent: res.percent > 0 ? `+${res.percent}%` : `${res.percent}%`,
          data: getKeyList(results, "count", false)
        });
      }
    });
  };
  const getUserLoginList = () => {
    getDashBoardUserLoginTrendApi().then(res => {
      if (res.code === SUCCESS_CODE) {
        userLoginList.value = res.data;
      }
    });
  };

  const getUserRegisterList = () => {
    getDashBoardUserRegisterTrendApi().then(res => {
      if (res.code === SUCCESS_CODE) {
        userRegisterList.value = res.data;
      }
    });
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
          operateLogList.value = res.data?.results ?? [];
        }
      });
  };

  onMounted(() => {
    getUserTotal();
    getUserLoginList();
    getUserLoginTotal();
    getTodayOperateTotal();
    getUserActiveList();
    getUserRegisterList();
  });

  return {
    t,
    loading,
    dataList,
    chartData,
    optionsBasis,
    userLoginList,
    userActiveList,
    operateLogList,
    userRegisterList
  };
}
