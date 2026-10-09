import { SUCCESS_CODE } from "@/api/types";
import type { useI18n } from "vue-i18n";
import { knowledgeApi, type KnowledgeSyncStatus } from "@/api/ai/knowledge";
import { usePollTask } from "@/hooks/usePollTask";
import { normalizeError } from "@/utils/apiError";
import { message } from "@/utils/message";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 仓库同步为后台任务：提交后经状态端点轮询终态摘要（与向量构建进度轮询同思路） */
export const SYNC_POLL_INTERVAL = 1500;
export const SYNC_POLL_TIMEOUT = 5 * 60 * 1000;

/**
 * 仓库同步（自 useKnowledgeActions 抽出）：提交后台任务 + 终态轮询。
 * 终态（done/error）或超时停止；组件卸载时经 usePollTask 清理定时器，
 * 卸载后不再发起请求、不再弹消息。
 */
export function useKnowledgeSync({
  t,
  refresh
}: {
  t: TFunction;
  refresh: () => void;
}) {
  const syncPoll = usePollTask<KnowledgeSyncStatus>({
    query: async () => {
      // 异常归一为可读失败结果：状态查询失败按一次无效轮询处理，下轮重试
      const res = await knowledgeApi.syncRepoStatus().catch(normalizeError);
      return (res.data as KnowledgeSyncStatus | null) ?? null;
    },
    interval: SYNC_POLL_INTERVAL,
    timeout: SYNC_POLL_TIMEOUT,
    isFinal: status => status.state !== "running" && status.state !== "idle",
    onFinal: status => {
      if (status.state === "done") {
        const summary = status.summary ?? {};
        message(
          t("aiKnowledge.syncDone", {
            created: summary.created ?? 0,
            updated: summary.updated ?? 0,
            removed: summary.removed ?? 0
          }),
          { type: "success" }
        );
        refresh();
        return;
      }
      message(String(status.detail || t("results.failed")), {
        type: "error"
      });
    },
    onTimeout: () =>
      message(t("aiKnowledge.syncPollTimeout"), { type: "warning" })
  });

  const pollSyncStatus = () => syncPoll.start();

  const syncRepo = async () => {
    // 异常归一为可读失败结果：提交可能因仓库不可达等失败，需给出可读原因
    const res = await knowledgeApi.syncRepo().catch(normalizeError);
    if (res.code !== SUCCESS_CODE) {
      // 已有同步在跑（1001，单飞锁）：提示进行中，不报错、不排队
      if (res.code === 1001) {
        message(t("aiKnowledge.syncAlreadyRunning"), { type: "info" });
        return;
      }
      message(res.detail ?? t("results.failed"), { type: "error" });
      return;
    }
    message(t("aiKnowledge.syncSubmitted"), { type: "info" });
    await pollSyncStatus();
  };

  return { syncRepo };
}
