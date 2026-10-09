import { ref } from "vue";
import type { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
import {
  aiAssistantApi,
  type AiActionDraft,
  type AiConsoleMessage
} from "@/api/ai/ai";
import { normalizeError } from "@/utils/apiError";
import { toIncoming } from "./useAiConsoleMessages";

type TFunction = ReturnType<typeof useI18n>["t"];

type ExecuteResponse = {
  code: number;
  data: unknown;
  detail?: string;
  type?: string;
};

/** 审批守卫业务码：type=approval_required 时后端以 1002（待审批）提示，上层引导去审批中心 */
const APPROVAL_REQUIRED_CODE = 1002;

/**
 * AI 控制台执行类操作（自 useAiConsole 抽出）：NL 查询运行与动作草稿执行。
 * 两者均由服务端重校验并落库消息，载荷回传后按持久化契约上屏。
 */
export function useAiConsoleActions({
  t,
  upsertMessage
}: {
  t: TFunction;
  upsertMessage: (incoming: AiConsoleMessage) => void;
}) {
  /** NL 查询运行中（运行按钮 loading） */
  const nlRunning = ref(false);

  /** 运行 NL 查询：服务端重校验 + 结果消息落库，载荷回传后上屏 */
  async function runNl(dsl: object): Promise<boolean> {
    if (nlRunning.value) return false;
    nlRunning.value = true;
    try {
      const res = (await aiAssistantApi
        .nlRun(dsl)
        .catch(normalizeError)) as ExecuteResponse;
      if (res.code === SUCCESS_CODE && res.data) {
        const incoming = toIncoming(
          (res.data as Record<string, unknown>).message
        );
        if (incoming) upsertMessage(incoming);
        return true;
      }
      message(String(res.detail || t("results.failed")), { type: "warning" });
      return false;
    } finally {
      nlRunning.value = false;
    }
  }

  /**
   * 执行已确认的动作草稿：以当前用户身份执行，服务端重校验 + 审计。
   * 412 + approval_required（需审批动作）返回 pending——审批通过后再次点击
   * 确认即原样重发，由 http 拦截器自动携带 X-Approval-Id。
   */
  async function executeAction(
    draft: AiActionDraft
  ): Promise<{ ok: boolean; pending?: boolean; detail?: string }> {
    const res = (await aiAssistantApi
      .actionExecute({ action: draft.action, params: draft.params })
      .catch((error: { code?: number; type?: string; detail?: string }) => ({
        code: Number(error?.code ?? -1),
        data: null,
        detail: String(error?.detail ?? error),
        type: error?.type
      }))) as ExecuteResponse;
    if (res.code === SUCCESS_CODE) {
      const incoming = toIncoming(
        (res.data as Record<string, unknown>)?.message
      );
      if (incoming) upsertMessage(incoming);
      return { ok: true, detail: String(res.detail || "") };
    }
    if (
      res.type === "approval_required" &&
      res.code === APPROVAL_REQUIRED_CODE
    ) {
      return { ok: false, pending: true, detail: res.detail };
    }
    return { ok: false, detail: res.detail };
  }

  return { nlRunning, runNl, executeAction };
}
