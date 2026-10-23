import { ref } from "vue";
import LoginLine from "~icons/ep/lock";
import LogLine from "~icons/ep/tickets";
import GroupLine from "~icons/ri/group-line";
import type { Component } from "vue";
import type { EpColorName } from "@/utils/chartTheme";
import type { DashboardTrendItem } from "@/api/system/dashboard";
import type { RecordType } from "plus-pro-components";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

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

/**
 * 首页数据容器（自 hook.tsx 抽出）：三张统计卡预分配固定槽位——各请求完成
 * 顺序不定，按下标回填避免卡片顺序竞态；占位先撑住卡位（名称/图标立即可见），
 * 数值请求返回后覆盖。
 */
export function createDashboardState(t: TFunction) {
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
  // 活跃用户固定四档（1/3/7/30 天）：先占位再回填，避免数据到达时行高从 0 撑开
  // 把下方图表/操作日志整行推下去（首屏 CLS）。
  const activeDays = [1, 3, 7, 30];
  const userActiveList = ref<UserActiveCardItem[]>(
    activeDays.map(days => ({
      name: days === 1 ? t("welcome.today") : `${days}${t("welcome.days")}`,
      value: [days, 0, 0],
      duration: 2200
    }))
  );
  /** 任一统计接口因缺少数据权限返回空集：页面顶部提示，避免把 0 当成真实值 */
  const scopeLimited = ref(false);
  /** 首屏取数进行中 / 任一卡片失败（页面统一提示并可重试） */
  const loading = ref(true);
  const loadFailed = ref(false);

  return {
    chartData,
    userLoginList,
    userRegisterList,
    operateLogList,
    userActiveList,
    scopeLimited,
    loading,
    loadFailed
  };
}

export type DashboardState = ReturnType<typeof createDashboardState>;
