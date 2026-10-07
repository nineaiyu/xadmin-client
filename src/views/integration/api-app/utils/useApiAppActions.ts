import { SUCCESS_CODE } from "@/api/types";
import { useI18n } from "vue-i18n";
import { useConfirm } from "@/hooks/useConfirm";
import { message } from "@/utils/message";
import {
  apiApplicationApi,
  type ApiApplicationCredential,
  type ApiApplicationItem,
  type CallbackProbeResult
} from "@/api/system/open";

/**
 * API 应用行内/抽屉动作：启停（失败回滚）、重置密钥（二次确认）、回调测试。
 * 回调测试结果由调用方传入的抽屉局部 state 持有并就地展示。
 */
export function useApiAppActions({
  refresh,
  openCredential
}: {
  refresh: () => void;
  openCredential: (data: ApiApplicationCredential) => void;
}) {
  const { t } = useI18n();
  const confirm = useConfirm();

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
    // 异常归一为可读失败结果：重置密钥失败必须给出原因（旧凭证已失效场景尤甚）
    const res = await apiApplicationApi
      .regenerateSecret(row.pk)
      .catch(error => ({
        code: -1,
        data: null,
        detail: String((error as { detail?: string })?.detail ?? error)
      }));
    if (res.code === SUCCESS_CODE && res.data) {
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
    confirm(t("apiApp.regenerateConfirm"), {
      title: t("apiApp.regenerate")
    }).then(ok => {
      if (ok) regenerateSecret(row);
    });
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
