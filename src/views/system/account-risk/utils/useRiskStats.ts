import { computed, ref, type UnwrapNestedRefs } from "vue";
import { useI18n } from "vue-i18n";
import type { accountRiskApi, AccountRiskStats } from "@/api/system/security";
import { isSuccess } from "@/api/types";
import { buildStatsGroups } from "./statsGroups";

/**
 * 账号安全风险统计面板（消费 stats 端点）。
 * 自 useAccountRisk 拆出：仅 stats 权限内拉取；加载失败置错误态，
 * 由页面显示「统计加载失败/重试」，与「没有风险」区分。
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
  const statsLoading = ref(false);
  /** 统计加载失败：与「没有风险」区分，页面显示可重试提示 */
  const statsError = ref(false);

  const statsGroups = computed(() =>
    stats.value ? buildStatsGroups(stats.value, t) : []
  );

  /** 刷新统计面板：仅 stats 权限内拉取；失败置错误态，由页面提供重试 */
  const refreshStats = () => {
    if (!auth.stats) return;
    statsLoading.value = true;
    statsError.value = false;
    api
      .stats()
      .then(res => {
        if (isSuccess(res)) {
          stats.value = res.data ?? null;
        } else {
          stats.value = null;
          statsError.value = true;
        }
      })
      .catch(() => {
        stats.value = null;
        statsError.value = true;
      })
      .finally(() => {
        statsLoading.value = false;
      });
  };

  return {
    stats,
    statsGroups,
    statsLoading,
    statsError,
    refreshStats
  };
}
