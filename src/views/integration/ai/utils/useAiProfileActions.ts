import { isSuccess } from "@/api/types";
import type { useI18n } from "vue-i18n";
import { useConfirm } from "@/hooks/useConfirm";
import { message } from "@/utils/message";
import { aiProfileApi, type AiProfileItem } from "@/api/ai/ai";
import { normalizeError } from "@/utils/apiError";

/**
 * AI 档案在线处置动作：激活/停用/删除（统一二次确认）+ 连通性测试 + 能力探测。
 * 探测结果落档案画像，前端按能力项提示（不阻断使用）。
 */
export function useAiProfileActions({
  t,
  refresh
}: {
  t: ReturnType<typeof useI18n>["t"];
  refresh: () => void;
}) {
  const confirm = useConfirm();

  const confirmThen = async (
    confirmText: string,
    action: () => Promise<{ code: number; detail?: string }>,
    doneText: string
  ) => {
    if (!(await confirm(confirmText, { title: t("aiConfig.profileTitle") }))) {
      return;
    }
    // 异常归一为可读失败结果：抽屉内触发的动作不应把异常抛到全局
    const res = await action().catch(normalizeError);
    if (isSuccess(res)) {
      message(doneText, { type: "success" });
      refresh();
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  };

  const activate = (row: AiProfileItem) =>
    confirmThen(
      t("aiConfig.activateConfirm"),
      () => aiProfileApi.activate(row.pk),
      t("aiConfig.activateDone")
    );

  const deactivate = (row: AiProfileItem) =>
    confirmThen(
      t("aiConfig.deactivateConfirm"),
      () => aiProfileApi.deactivate(row.pk),
      t("aiConfig.deactivateDone")
    );

  const removeProfile = (row: AiProfileItem) =>
    confirmThen(
      t("aiConfig.deleteConfirm"),
      () => aiProfileApi.destroy(row.pk),
      t("aiConfig.deleteDone")
    );

  /** 轮询间隔与总等待：外呼在 celery 执行，正常 1~3 秒出结论，60 秒是兜底上限 */
  const POLL_INTERVAL = 1_500;
  const POLL_TIMEOUT = 60_000;

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  /**
   * 连通性测试：提交即返回（请求线程不再外呼供应商），再按 task_id 轮询结论。
   * eager 环境（测试 / E2E）没有结果后端，提交响应里已带最终结论，直接消费不再轮询。
   */
  const testProfile = async (row: AiProfileItem) => {
    // 异常归一为可读失败结果：网络/HTTP 异常不应产生未处理的 Promise 拒绝
    const submitted = await aiProfileApi.test(row.pk).catch(normalizeError);
    if (!isSuccess(submitted)) {
      if (submitted.detail)
        message(String(submitted.detail), { type: "warning" });
      return;
    }

    const showOutcome = (ok: boolean | undefined, detail?: string) => {
      if (ok) {
        message(String(detail || t("aiConfig.testOk")), { type: "success" });
      } else {
        message(String(detail || t("aiConfig.testFailed")), {
          type: "warning"
        });
      }
    };

    const first = submitted.data as {
      task_id?: string;
      state?: string;
      ok?: boolean;
      detail?: string;
    };
    if (first?.state === "SUCCESS") {
      showOutcome(first.ok, first.detail);
      return;
    }
    const taskId = first?.task_id;
    if (!taskId) {
      if (submitted.detail)
        message(String(submitted.detail), { type: "warning" });
      return;
    }

    const deadline = Date.now() + POLL_TIMEOUT;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL);
      const polled = await aiProfileApi
        .testResult(row.pk, taskId)
        .catch(() => null);
      if (!polled || !isSuccess(polled)) continue;
      const data = polled.data as {
        state?: string;
        ok?: boolean;
        detail?: string;
      };
      if (data?.state === "SUCCESS" || data?.state === "FAILURE") {
        showOutcome(data.state === "SUCCESS" ? data.ok : false, data.detail);
        return;
      }
    }
    message(t("aiConfig.testTimeout"), { type: "warning" });
  };

  /** 能力探测：结果落档案画像，前端按能力项提示（不阻断使用）
   *  withVision=true 追加多模态探测（默认按钮不触发，避免无多模态模型上的无谓等待） */
  const probeProfile = async (row: AiProfileItem, withVision = false) => {
    const res = await aiProfileApi
      .probe(row.pk, withVision ? { vision: true } : undefined)
      .catch(normalizeError);
    if (isSuccess(res)) {
      const data = ((res as { data?: Record<string, { ok?: boolean }> }).data ??
        {}) as Record<string, { ok?: boolean } | undefined>;
      const okList = ["json", "tool_calls", "reasoning"]
        .concat(withVision ? ["vision"] : [])
        .filter(key => data[key]?.ok);
      message(
        `${t("aiConfig.probeDone")}: ${okList.length ? okList.join(" / ") : t("aiConfig.capUnknown")}`,
        { type: "success" }
      );
      refresh();
      return;
    }
    if (res.detail) message(String(res.detail), { type: "warning" });
  };

  return {
    activate,
    deactivate,
    removeProfile,
    testProfile,
    probeProfile
  };
}
