import { SUCCESS_CODE } from "@/api/types";
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
    if (res.code === SUCCESS_CODE) {
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

  const testProfile = async (row: AiProfileItem) => {
    const res = await aiProfileApi.test(row.pk);
    if (res.code === SUCCESS_CODE) {
      message(String(res.detail ?? t("aiConfig.testOk")), { type: "success" });
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  };

  /** 能力探测：结果落档案画像，前端按能力项提示（不阻断使用）
   *  withVision=true 追加多模态探测（默认按钮不触发，避免无多模态模型上的无谓等待） */
  const probeProfile = async (row: AiProfileItem, withVision = false) => {
    const res = await aiProfileApi
      .probe(row.pk, withVision ? { vision: true } : undefined)
      .catch(normalizeError);
    if (res.code === SUCCESS_CODE) {
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
