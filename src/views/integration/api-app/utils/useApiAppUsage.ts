import { isSuccess } from "@/api/types";
import { ref, watch } from "vue";
import { message } from "@/utils/message";
import {
  apiApplicationApi,
  type ApiApplicationItem,
  type ApplicationUsageStats
} from "@/api/identity/open";
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
    if (isSuccess(res)) {
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
    // 抽屉可见性必须在这里置真：拉数据不等于打开抽屉（漏掉这行时界面毫无反应）
    usageVisible.value = true;
    await fetchUsage();
  };

  // 关闭即清场：下次打开不会先渲染上一次应用的数据（也避免切换窗口请求回填旧行）
  watch(usageVisible, visible => {
    if (visible) return;
    usageSeq += 1;
    usage.value = null;
    usageRow.value = null;
  });

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
