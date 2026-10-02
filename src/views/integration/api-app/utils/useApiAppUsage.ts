import { SUCCESS_CODE } from "@/api/types";
import { ref } from "vue";
import { message } from "@/utils/message";
import {
  apiApplicationApi,
  type ApiApplicationItem,
  type ApplicationUsageStats
} from "@/api/system/open";

/** 用量报表（抽屉）：7 天窗口统计，异常归一避免抽屉 loading 悬挂 */
export function useApiAppUsage() {
  const usageVisible = ref(false);
  const usageLoading = ref(false);
  const usageRow = ref<ApiApplicationItem | null>(null);
  const usage = ref<ApplicationUsageStats | null>(null);

  const openUsage = async (row: ApiApplicationItem) => {
    usageRow.value = row;
    usage.value = null;
    usageVisible.value = true;
    usageLoading.value = true;
    // 异常归一：抽屉 loading 不悬挂
    const res = await apiApplicationApi.stats(row.pk, 7).catch(error => ({
      code: -1,
      data: null,
      detail: String((error as { detail?: string })?.detail ?? error)
    }));
    usageLoading.value = false;
    if (res.code === SUCCESS_CODE) {
      usage.value = res.data as ApplicationUsageStats;
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  };

  return { usageVisible, usageLoading, usageRow, usage, openUsage };
}
