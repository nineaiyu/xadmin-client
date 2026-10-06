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
  // 三张统计卡预分配固定槽位：各请求完成顺序不定，按下标回填避免卡片顺序竞态；
  // 占位先撑住卡位（名称/图标立即可见），数值请求返回后覆盖
  const chartData = ref<ChartCardItem[]>([
    {
      icon: LogLine,
      tone: "warning",
      duration: 2200,
      name: t("welcome.requestNum"),
      value: 0,
      percent: "",
      data: []
    },
    {
      icon: GroupLine,
      tone: "success",
      duration: 2200,
      name: t("welcome.userNum"),
      value: 0,
      percent: "",
      data: []
    },
    {
      icon: LoginLine,
      tone: "primary",
      duration: 2200,
      name: t("welcome.loginTimes"),
      value: 0,
      percent: "",
      data: []
    }
  ]);
  const userLoginList = ref<DashboardTrendItem[]>([]);
  const userRegisterList = ref<DashboardTrendItem[]>([]);
  const operateLogList = ref<RecordType[]>([]);
  const userActiveList = ref<UserActiveCardItem[]>([]);

  const getUserActiveList = () => {
    getDashBoardUserActiveApi()
      .then(res => {
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
      })
      .catch(() => undefined);
  };

  const getTodayOperateTotal = () => {
    getDashBoardTodayOperateTotalApi()
      .then(res => {
        if (res.code === SUCCESS_CODE) {
          const results = res.results ?? [];
          // 空结果时按天取数的下标越界，value 兜底 0
          chartData.value[0] = {
            ...chartData.value[0],
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
          chartData.value[1] = {
            ...chartData.value[1],
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
          chartData.value[2] = {
            ...chartData.value[2],
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
          userLoginList.value = res.data;
        }
      })
      .catch(() => undefined);
  };

  const getUserRegisterList = () => {
    getDashBoardUserRegisterTrendApi()
      .then(res => {
        if (res.code === SUCCESS_CODE) {
          userRegisterList.value = res.data;
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
          operateLogList.value = res.data?.results ?? [];
        }
      })
      .catch(() => undefined);
  };

  // 首页各卡片独立取数：单个请求失败只缺对应卡片（提示由 http 层统一给出），不阻断其余卡片
  onMounted(() => {
    getUserTotal();
    getUserLoginList();
    getUserLoginTotal();
    getTodayOperateTotal();
    getUserActiveList();
    getUserRegisterList();
    // 操作日志时间线与统计接口互不依赖：独立发起，不随 today-operate-total 的成败与耗时联动
    if (hasAuth("list:SystemOperationLog")) {
      getOperateLogList();
    }
  });

  return {
    t,
    chartData,
    optionsBasis,
    userLoginList,
    userActiveList,
    operateLogList,
    userRegisterList
  };
}
