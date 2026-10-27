import { onMounted, ref } from "vue";

import { isSuccess } from "@/api/types";
import {
  settingsCaptchaLogApi,
  settingsCaptchaStatsApi,
  type CaptchaStatsData
} from "@/api/system/settings";
import { defineListPage } from "@/components/RePlusPage";
import { hasAuth } from "@/router/utils";
import { normalizeError } from "@/utils/apiError";

/**
 * 验证码「验证数据」页签：大盘聚合 + 观测日志列表。
 *
 * 日志列表复用元数据协议（后端 table_fields + search-columns），
 * 页面不手写表格与权限判断；两个端点各自独立权限位。
 */
export function useCaptchaData() {
  const page = defineListPage({
    api: settingsCaptchaLogApi,
    localeName: "settingCaptcha",
    authSuffix: "SecurityCaptchaLog"
  });
  // 观测数据是审计痕迹：列表只读，没有新建 / 编辑 / 删除入口
  page.auth.create = false;
  page.auth.update = false;
  page.auth.partialUpdate = false;
  page.auth.destroy = false;
  page.auth.batchDestroy = false;
  page.auth.importData = false;

  const stats = ref<CaptchaStatsData | null>(null);
  const statsLoading = ref(false);
  const statsError = ref("");
  const hours = ref(24);
  const canViewStats = hasAuth("list:SecurityCaptchaStats");

  async function loadStats() {
    if (!canViewStats) {
      stats.value = null;
      statsLoading.value = false;
      statsError.value = "";
      return;
    }
    statsLoading.value = true;
    statsError.value = "";
    try {
      const res = await settingsCaptchaStatsApi.stats(hours.value);
      if (isSuccess(res)) {
        stats.value = res.data;
      } else {
        stats.value = null;
        statsError.value = String(res.detail || "");
      }
    } catch (error) {
      stats.value = null;
      statsError.value = normalizeError(error).detail;
    } finally {
      statsLoading.value = false;
    }
  }

  function changeWindow(value: number) {
    hours.value = value;
    void loadStats();
  }

  onMounted(loadStats);

  return {
    ...page,
    stats,
    statsLoading,
    statsError,
    hours,
    canViewStats,
    loadStats,
    changeWindow
  };
}
