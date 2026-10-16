import type { useI18n } from "vue-i18n";
import { knowledgeApi, type KnowledgeBuildStatus } from "@/api/ai/knowledge";
import { usePollTask } from "@/hooks/usePollTask";
import { normalizeError } from "@/utils/apiError";
import { message } from "@/utils/message";
import {
  BUILD_POLL_INTERVAL,
  BUILD_POLL_TIMEOUT,
  findMilestone
} from "./buildMilestones";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 向量构建进度轮询（自 useKnowledgeBuild 抽出）：运行中按里程碑提示（过程可见
 * 不刷屏），终态给摘要。经 usePollTask 随创建作用域注册卸载清理——此前手写
 * while 无清理能力，组件卸载后仍会继续请求并弹消息。
 */
export function useKnowledgeBuildPoll({
  t,
  refresh
}: {
  t: TFunction;
  refresh: () => void;
}) {
  /** 上次已达成的百分比（里程碑只在跨过 25/50/75 时提示；每次构建开始时重置） */
  let lastPercent = 0;

  const buildPoll = usePollTask<KnowledgeBuildStatus>({
    query: async () => {
      // 异常归一为可读失败结果：状态查询失败按一次无效轮询处理，下轮重试
      const res = await knowledgeApi
        .buildEmbeddingsStatus()
        .catch(normalizeError);
      return (res.data as KnowledgeBuildStatus | null) ?? null;
    },
    interval: BUILD_POLL_INTERVAL,
    timeout: BUILD_POLL_TIMEOUT,
    isFinal: status => status.state !== "running",
    onTick: status => {
      const milestone = findMilestone(lastPercent, status.percent);
      if (milestone) {
        message(t("aiKnowledge.buildProgress", { percent: status.percent }), {
          type: "info"
        });
      }
      lastPercent = status.percent;
    },
    onFinal: status => {
      if (status.state === "done") {
        const summary = status.summary;
        message(
          t("aiKnowledge.buildDone", {
            embedded: summary?.embedded ?? 0,
            skipped: summary?.skipped ?? 0
          }),
          { type: "success" }
        );
        refresh();
        return;
      }
      message(String(status.summary?.detail || t("results.failed")), {
        type: "error"
      });
    },
    onTimeout: () =>
      message(t("aiKnowledge.buildPollTimeout"), { type: "warning" })
  });

  const pollBuildStatus = () => {
    lastPercent = 0;
    return buildPoll.start();
  };

  return { pollBuildStatus };
}
