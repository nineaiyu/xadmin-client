import { onActivated, onMounted, ref } from "vue";
import { isSuccess } from "@/api/types";
import { aiAssistantApi, type AiUsageSummary } from "@/api/ai/ai";

/** 观测面板可选统计周期（天）：短周期样本足、口径稳；长周期数据薄且 P95 失真 */
export const AI_USAGE_DAY_OPTIONS = [7, 30];

/**
 * AI 用量观测数据源：一次请求同时供统计卡、日趋势与档案/模型分布消费。
 *
 * 原页面三处（调用观测卡 / 用量账本卡 / 运行看板）各自请求 usage 端点且周期
 * 口径不一（同页出现互相矛盾的成功率），收敛为单一数据源 + 单一切换入口。
 * 挂载与 keep-alive 二次进入各拉一次（离开期间的新调用不漏刷）。
 */
export function useAiUsage(initialDays: number = AI_USAGE_DAY_OPTIONS[0]) {
  const days = initialDays;
  const usageDays = ref<number>(days);
  const usage = ref<AiUsageSummary | null>(null);
  const loading = ref(false);

  const loadUsage = async () => {
    loading.value = true;
    try {
      const res = await aiAssistantApi.usage(usageDays.value).catch(() => null);
      if (res && isSuccess(res)) {
        usage.value = res.data as AiUsageSummary;
      } else if (usageDays.value !== days) {
        // 切换周期失败：清空而非保留旧周期数据（否则新周期标题下挂着旧统计）。
        // 初始周期失败保留已渲染数据（重访刷新失败不把页面打成空态）。
        usage.value = null;
      }
    } finally {
      loading.value = false;
    }
  };

  const loadUsageWithDays = async (next?: number | string | boolean) => {
    usageDays.value = Number(next);
    await loadUsage();
  };

  onMounted(loadUsage);

  // keep-alive 页面二次进入不重跑 onMounted：重拉最新用量
  onActivated(loadUsage);

  return { usageDays, usage, loading, loadUsage, loadUsageWithDays };
}
