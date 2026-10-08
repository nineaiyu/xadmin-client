import { computed, ref, type UnwrapNestedRefs } from "vue";
import { useI18n } from "vue-i18n";
import type { accountRiskApi, AccountRiskStats } from "@/api/system/security";
import { SUCCESS_CODE } from "@/api/types";
import type { StatsGroup } from "./stats";
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

/**
 * 账号安全风险统计面板（消费 stats 端点）。
 * 自 useAccountRisk 拆出（行为不变）：仅 stats 权限内拉取；加载失败静默降级
 * 为不渲染（不提示、不阻断列表）。
 */
export function useRiskStats({
  api,
  auth
}: {
  // reactive(accountRiskApi) 的类型：UnwrapNestedRefs 映射剥离类私有成员，
  // 直接用 typeof accountRiskApi 会因缺 private 成员而不可赋值
  api: UnwrapNestedRefs<typeof accountRiskApi>;
  auth: { stats?: boolean };
}) {
  const { t } = useI18n();
  const stats = ref<AccountRiskStats | null>(null);

  const statsGroups = computed<StatsGroup[]>(() => {
    const data = stats.value;
    if (!data) return [];
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
  });

  /** 刷新统计面板：仅 stats 权限内拉取；加载失败静默降级为不渲染（不提示、不阻断列表） */
  const refreshStats = () => {
    if (!auth.stats) return;
    api
      .stats()
      .then(res => {
        stats.value = res.code === SUCCESS_CODE ? (res.data ?? null) : null;
      })
      .catch(() => {
        stats.value = null;
      });
  };

  return { statsGroups, refreshStats };
}
