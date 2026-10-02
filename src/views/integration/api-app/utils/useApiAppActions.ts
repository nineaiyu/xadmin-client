import { SUCCESS_CODE } from "@/api/types";
import { useI18n } from "vue-i18n";
import { ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import {
  apiApplicationApi,
  type ApiApplicationCredential,
  type ApiApplicationItem,
  type CallbackProbeResult
} from "@/api/system/open";
import type { Ref } from "vue";

/**
 * API 应用行内/抽屉动作：启停（失败回滚）、重置密钥（二次确认）、回调测试。
 * 回调测试结果同时写入抽屉内局部 state 与页面级 probeResults（一次性展示口径）。
 */
export function useApiAppActions({
  refresh,
  openCredential,
  probeResults
}: {
  refresh: () => void;
  openCredential: (data: ApiApplicationCredential) => void;
  probeResults: Ref<CallbackProbeResult[]>;
}) {
  const { t } = useI18n();

  /* ---------------- 行内启停 / 重置密钥 / 回调测试 ---------------- */
  const toggleActive = async (row: ApiApplicationItem, value: boolean) => {
    row.is_active = value;
    const res = await apiApplicationApi
      .partialUpdate(row.pk, { is_active: value })
      .catch(error => ({
        code: -1,
        detail: String((error as { detail?: string })?.detail ?? error)
      }));
    if (res.code === SUCCESS_CODE) return;
    row.is_active = !value;
    message(String(res.detail ?? t("apiApp.saveFailed")), { type: "warning" });
  };

  const regenerateSecret = async (row: ApiApplicationItem) => {
    const res = await apiApplicationApi.regenerateSecret(row.pk);
    if (res.code === SUCCESS_CODE) {
      openCredential(res.data);
      refresh();
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  };

  /**
   * 重置密钥：旧凭证立即失效、第三方集成需同步更新 —— 执行前二次确认。
   * （抽屉内触发，确认框为独立遮罩层，不依赖抽屉状态）
   */
  const confirmRegenerate = (row: ApiApplicationItem) => {
    ElMessageBox.confirm(
      t("apiApp.regenerateConfirm"),
      t("apiApp.regenerate"),
      {
        confirmButtonText: t("buttons.sure"),
        cancelButtonText: t("buttons.cancel"),
        type: "warning"
      }
    )
      .then(() => regenerateSecret(row))
      .catch(() => undefined);
  };

  /** 回调测试：state 由抽屉持有（测试结果在抽屉内即时展示） */
  const runCallbackProbe = async (
    row: ApiApplicationItem,
    state?: { loading: boolean; results: CallbackProbeResult[] }
  ) => {
    if (state) {
      state.loading = true;
      state.results = [];
    }
    const res = await apiApplicationApi.testCallback(row.pk).catch(error => ({
      code: -1,
      data: null,
      detail: String((error as { detail?: string })?.detail ?? error)
    }));
    if (state) state.loading = false;
    if (res.code === SUCCESS_CODE) {
      const results = res.data?.results ?? [];
      probeResults.value = results;
      if (state) state.results = results;
      const failed = results.filter(item => !item.success).length;
      message(
        failed
          ? t("apiApp.callbackFailed", { count: failed })
          : t("apiApp.callbackOk"),
        { type: failed ? "warning" : "success" }
      );
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  };

  return { toggleActive, confirmRegenerate, runCallbackProbe };
}
