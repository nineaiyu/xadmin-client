import { SUCCESS_CODE } from "@/api/types";
import { ref } from "vue";
import { message } from "@/utils/message";
import {
  apiApplicationApi,
  type ApiApplicationItem,
  type ApplicationUsageStats
} from "@/api/system/open";
import { normalizeError } from "@/utils/apiError";

/** 用量报表可选窗口（服务端上限 30 天） */
export const USAGE_DAY_OPTIONS = [1, 7, 14, 30];

/**
 * 用量报表（抽屉）：统计窗口可选（默认 7 天，切换即重拉），
 * 异常归一避免抽屉 loading 悬挂。
 */
export function useApiAppUsage() {
  const usageVisible = ref(false);
  const usageLoading = ref(false);
  const usageRow = ref<ApiApplicationItem | null>(null);
  const usageDays = ref(7);
  const usage = ref<ApplicationUsageStats | null>(null);
  // 请求序号：快速切换统计窗口时仅采纳最后一次请求的响应
  let usageSeq = 0;

  const fetchUsage = async () => {
    const row = usageRow.value;
    if (!row) return;
    const seq = ++usageSeq;
    usageLoading.value = true;
    // 异常归一：抽屉 loading 不悬挂
    const res = await apiApplicationApi
      .stats(row.pk, usageDays.value)
      .catch(normalizeError);
    if (seq !== usageSeq) return;
    usageLoading.value = false;
    if (res.code === SUCCESS_CODE) {
      usage.value = res.data as ApplicationUsageStats;
    } else {
      usage.value = null;
      if (res.detail) message(String(res.detail), { type: "warning" });
    }
  };

  const openUsage = async (row: ApiApplicationItem) => {
    usageRow.value = row;
    usage.value = null;
    usageDays.value = 7;
    await fetchUsage();
  };

  /** 切换统计窗口（抽屉头部选项）：重拉当前应用的用量 */
  const setUsageDays = async (days: number) => {
    if (!usageRow.value || days === usageDays.value) return;
    usageDays.value = days;
    await fetchUsage();
  };

  return {
    usageVisible,
    usageLoading,
    usageRow,
    usageDays,
    usage,
    openUsage,
    setUsageDays
  };
}
