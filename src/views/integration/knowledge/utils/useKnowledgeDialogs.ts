import { h, ref } from "vue";
import type { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { openManageDrawer } from "@/components/ReActionPanel";
import { SUCCESS_CODE } from "@/api/types";
import { knowledgeApi } from "@/api/ai/knowledge";
import { normalizeError } from "@/utils/apiError";
import { message } from "@/utils/message";
import KnowledgeUploadDialog from "../components/KnowledgeUploadDialog.vue";
import KnowledgePanel from "../components/KnowledgePanel.vue";
import { buildKnowledgeActionGroups } from "./knowledgeActions";
import type { KnowledgeRow } from "./useKnowledgeDocument";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 行内字典化字段取标量值：后端 LabeledChoice 下发 {value,label}（或原始字符串） */
export const dictValue = (value: unknown): string =>
  typeof value === "string"
    ? value
    : ((value as { value?: string })?.value ?? "");

/**
 * 知识库弹层（自 useKnowledgeActions 抽出）：上传弹窗与「管理文档」抽屉
 * （资料 + 全文/分块 + 启停/删除动作，行操作唯一入口）。
 */
export function useKnowledgeDialogs({
  t,
  refresh,
  flags: { canUpdate, canDestroy },
  document: { toggleActive, confirmRemove }
}: {
  t: TFunction;
  refresh: () => void;
  flags: { canUpdate: boolean; canDestroy: boolean };
  document: {
    toggleActive: (row: KnowledgeRow) => Promise<void>;
    confirmRemove: (row: KnowledgeRow) => void;
  };
}) {
  const uploadFormRef = ref<InstanceType<typeof KnowledgeUploadDialog>>();

  const openUpload = () => {
    uploadFormRef.value = undefined;
    addDialog({
      title: t("aiKnowledge.uploadTitle"),
      width: "640px",
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () => h(KnowledgeUploadDialog, { ref: uploadFormRef }),
      beforeSure: async (done, { closeLoading }) => {
        const payload = uploadFormRef.value?.getPayload();
        if (!payload) {
          closeLoading();
          return;
        }
        // 异常归一为可读失败结果，避免请求异常时弹窗 loading 悬挂
        const res = await knowledgeApi
          .upload(payload.name, payload)
          .catch(normalizeError);
        if (res.code !== SUCCESS_CODE) {
          message(`${t("results.failed")}，${res.detail}`, { type: "error" });
          return;
        }
        message(res.detail ?? t("aiKnowledge.uploadDone"), { type: "success" });
        // 先关弹窗再刷新列表，避免刷新耗时导致弹窗滞留
        done();
        refresh();
      }
    });
  };

  const openKnowledgePanel = (row: KnowledgeRow) => {
    openManageDrawer({
      title: t("aiKnowledge.panelTitle", { title: row.title }),
      size: "55%",
      drawerOptions: { closeOnClickModal: false },
      render: ({ withClosed }) =>
        h(KnowledgePanel, {
          row,
          groups: buildKnowledgeActionGroups({
            t,
            flags: { canUpdate, canDestroy },
            target: {
              isActive: Boolean(row.is_active),
              removable: dictValue(row.source_type) === "upload"
            },
            handlers: {
              // 状态变更类动作执行前先收起抽屉：抽屉内的状态标签与动作文案基于
              // 行快照，收起后重开即为最新状态（同时避免与确认弹窗叠加）
              toggle: withClosed(() => toggleActive(row)),
              remove: withClosed(() => confirmRemove(row))
            }
          })
        })
    });
  };

  return { openUpload, openKnowledgePanel };
}
