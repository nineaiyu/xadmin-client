import type { Ref } from "vue";
import { SUCCESS_CODE } from "@/api/types";
import type { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { knowledgeApi } from "@/api/ai/knowledge";
import { normalizeError } from "@/utils/apiError";
import { message } from "@/utils/message";
import { useKnowledgeSync } from "./useKnowledgeSync";
import { useKnowledgeDocument } from "./useKnowledgeDocument";
import { useKnowledgeDialogs } from "./useKnowledgeDialogs";

export { SYNC_POLL_INTERVAL, SYNC_POLL_TIMEOUT } from "./useKnowledgeSync";
export { dictValue } from "./useKnowledgeDialogs";

/**
 * 知识库行/工具栏动作：上传弹窗、启停/删除、仓库同步、批量启停与管理抽屉。
 *
 * 职责拆分：
 * - useKnowledgeSync      仓库同步（提交后台任务 + 终态轮询）；
 * - useKnowledgeDocument  单文档启停与删除（二次确认）；
 * - useKnowledgeDialogs   上传弹窗与「管理文档」抽屉。
 */
export function useKnowledgeActions({
  t,
  tableRef
}: {
  t: ReturnType<typeof useI18n>["t"];
  tableRef: Ref;
}) {
  const canUpdate = hasAuth("partialUpdate:AiKnowledge");
  const canDestroy = hasAuth("destroy:AiKnowledge");

  const refresh = () => tableRef.value?.handleGetData();

  const { syncRepo } = useKnowledgeSync({ t, refresh });

  const { toggleActive, confirmRemove } = useKnowledgeDocument({ t, refresh });

  const { openUpload, openKnowledgePanel } = useKnowledgeDialogs({
    t,
    refresh,
    flags: { canUpdate, canDestroy },
    document: { toggleActive, confirmRemove }
  });

  /** 批量启停：取勾选行 pk，未勾选时按项目既有口径提示 */
  const batchToggle = (isActive: boolean) => async () => {
    const pks = tableRef.value?.getSelectPks("pk") ?? [];
    if (!pks.length) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    // 异常归一为可读失败结果：批量启停失败需给出可读原因
    const res = await knowledgeApi
      .batchToggle(pks, isActive)
      .catch(normalizeError);
    if (res.code === SUCCESS_CODE) {
      const changed = (res.data as { changed?: number })?.changed ?? 0;
      message(t("aiKnowledge.batchToggleDone", { count: changed }), {
        type: "success"
      });
      tableRef.value?.onSelectionCancel?.();
      refresh();
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  };

  return {
    openUpload,
    openKnowledgePanel,
    syncRepo,
    batchToggle
  };
}
