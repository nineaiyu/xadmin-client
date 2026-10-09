import { SUCCESS_CODE } from "@/api/types";
import {
  knowledgeApi,
  type KnowledgeBuildStatus,
  type KnowledgeVectorStatus
} from "@/api/ai/knowledge";
import { useConfirm } from "@/hooks/useConfirm";
import { normalizeError } from "@/utils/apiError";
import { message } from "@/utils/message";
import {
  BUILD_POLL_INTERVAL,
  BUILD_POLL_TIMEOUT,
  findMilestone
} from "./buildMilestones";
import { useKnowledgeBuildPoll } from "./useKnowledgeBuildPoll";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

export { BUILD_POLL_INTERVAL, BUILD_POLL_TIMEOUT, findMilestone };

/**
 * 构建向量索引：状态查询 → 确认提交 → 进度轮询（单飞锁与既有任务跟踪在装配层；
 * 轮询见 useKnowledgeBuildPoll）。
 */
export function useKnowledgeBuild({
  t,
  refresh
}: {
  t: TFunction;
  refresh: () => void;
}) {
  const confirm = useConfirm();
  const { pollBuildStatus } = useKnowledgeBuildPoll({ t, refresh });

  /**
   * 构建向量索引（增量，后台任务）：先取状态——未配置 embedding 档案时给引导；
   * 已配置则确认后提交任务并轮询进度（单飞锁，重复提交被引导为跟踪既有任务）。
   * 构建只补「未向量化 / 模型变更 / 正文变更」的块，可反复执行；全量重算用
   * `manage.py build_ai_embeddings --force`。
   */
  const buildEmbeddings = async () => {
    const statusRes = await knowledgeApi.vectorStatus().catch(normalizeError);
    const status = statusRes.data as KnowledgeVectorStatus | null;
    if (!status?.enabled) {
      message(t("aiKnowledge.vectorDisabled"), { type: "warning" });
      return;
    }
    if (
      !(await confirm(
        t("aiKnowledge.buildConfirm", {
          fresh: status.fresh,
          total: status.total,
          model: status.model
        }),
        {
          title: t("aiKnowledge.buildEmbeddings"),
          type: "info"
        }
      ))
    ) {
      return;
    }
    const res = await knowledgeApi.buildEmbeddings().catch(normalizeError);
    if (res.code !== SUCCESS_CODE) {
      // 已有构建在跑（1001 + running 状态）：不报错，转为跟踪既有任务进度
      const running = (res as { data?: KnowledgeBuildStatus | null }).data;
      if (res.code === 1001 && running?.state === "running") {
        message(t("aiKnowledge.buildAlreadyRunning"), { type: "info" });
        await pollBuildStatus();
        return;
      }
      message(res.detail ?? t("results.failed"), { type: "error" });
      return;
    }
    message(t("aiKnowledge.buildSubmitted"), { type: "success" });
    await pollBuildStatus();
  };

  return { buildEmbeddings };
}
