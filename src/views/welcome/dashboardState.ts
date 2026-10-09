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
  const userActiveList = ref<UserActiveCardItem[]>([]);

  return {
    chartData,
    userLoginList,
    userRegisterList,
    operateLogList,
    userActiveList
  };
}

export type DashboardState = ReturnType<typeof createDashboardState>;
