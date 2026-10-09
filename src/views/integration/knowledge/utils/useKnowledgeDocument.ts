import { SUCCESS_CODE } from "@/api/types";
import type { useI18n } from "vue-i18n";
import { handleOperation } from "@/components/RePlusPage";
import { knowledgeApi, type KnowledgeDocumentItem } from "@/api/ai/knowledge";
import { useConfirm } from "@/hooks/useConfirm";
import { normalizeError } from "@/utils/apiError";
import { message } from "@/utils/message";

export type KnowledgeRow = KnowledgeDocumentItem & { is_active: boolean };

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 单文档处置（自 useKnowledgeActions 抽出）：启用/停用与删除（仅上传来源，
 * 执行前二次确认，分块级联清理）。
 */
export function useKnowledgeDocument({
  t,
  refresh
}: {
  t: TFunction;
  refresh: () => void;
}) {
  const confirm = useConfirm();

  const toggleActive = async (row: KnowledgeRow) => {
    // 异常归一为可读失败结果：启停失败（分块重建被拒等）需给出可读原因
    const res = await knowledgeApi
      .partialUpdate(row.pk, {
        is_active: !row.is_active
      })
      .catch(normalizeError);
    if (res.code === SUCCESS_CODE) {
      message(t("aiKnowledge.toggleDone"), { type: "success" });
      refresh();
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  };

  const removeDocument = (row: KnowledgeRow) => {
    handleOperation({
      t,
      apiReq: knowledgeApi.destroy(row.pk),
      success() {
        message(t("aiKnowledge.deleteDone"), { type: "success" });
        refresh();
      }
    });
  };

  const confirmRemove = (row: KnowledgeRow) => {
    confirm(t("aiKnowledge.deleteConfirm"), {
      title: t("buttons.delete")
    }).then(ok => {
      if (ok) removeDocument(row);
    });
  };

  return { toggleActive, confirmRemove };
}
