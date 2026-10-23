import type { useI18n } from "vue-i18n";
import type { AccountRiskStats } from "@/api/system/security";
import {
  LEVEL_LABEL_KEYS,
  LEVEL_ORDER,
  LEVEL_TAG,
  RISK_TYPE_KEYS,
  STATUS_LABEL_KEYS,
  STATUS_ORDER,
  STATUS_TAG,
  chipsOf
} from "./display";
import type { StatsGroup } from "./stats";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 统计端点响应 → 面板分组（概览 / 等级 / 状态 / 类型） */
export function buildStatsGroups(
  data: AccountRiskStats,
  t: TFunction
): StatsGroup[] {
  const groups: StatsGroup[] = [
    {
      key: "overview",
      title: t("accountRisk.statsOverview"),
      chips: [
        {
          key: "total",
          label: t("accountRisk.statsTotal"),
          type: "primary",
          count: data.total
        },
        {
          key: "pending",
          label: t("accountRisk.statusPending"),
          type: STATUS_TAG.pending,
          count: data.pending
        }
      ]
    },
    {
      key: "level",
      title: t("accountRisk.statsByLevel"),
      chips: chipsOf(
        data.by_level ?? {},
        LEVEL_ORDER,
        LEVEL_LABEL_KEYS,
        LEVEL_TAG,
        t
      )
    },
    {
      key: "status",
      title: t("accountRisk.statsByStatus"),
      chips: chipsOf(
        data.by_status ?? {},
        STATUS_ORDER,
        STATUS_LABEL_KEYS,
        STATUS_TAG,
        t
      )
    },
    {
      key: "type",
      title: t("accountRisk.statsByType"),
      chips: (data.by_type ?? []).map(item => ({
        key: item.risk_type,
        label: RISK_TYPE_KEYS[item.risk_type]
          ? t(RISK_TYPE_KEYS[item.risk_type])
          : item.risk_type,
        count: item.count
      }))
    }
  ];
  return groups.filter(group => group.chips.length > 0);
}
