import { h, ref } from "vue";
import type { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { openManageDrawer } from "@/components/ReActionPanel";
import { useDialogForm } from "@/hooks/useDialogForm";
import { knowledgeApi } from "@/api/ai/knowledge";
import { message } from "@/utils/message";
import KnowledgeUploadDialog from "../components/KnowledgeUploadDialog.vue";
import type { UploadPayload } from "./knowledgePayload";
import KnowledgePanel from "../components/KnowledgePanel.vue";
import { buildKnowledgeActionGroups } from "./knowledgeActions";
import type { KnowledgeRow } from "./useKnowledgeDocument";

import { dialogSize, drawerSize } from "@/components/ReDialog/size";
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
    // 显式指定载荷泛型：ref 包装的实例类型无法从 getPayload 返回类型反推（TS 退化 unknown）
    const { beforeSure } = useDialogForm<UploadPayload>({
      formRef: uploadFormRef,
      submit: async payload => {
        // 二进制解析在服务端进行：提交期间显示「解析中」而不只转按钮
        uploadFormRef.value?.setSubmitting?.(true);
        try {
          return await knowledgeApi.upload(payload.name, payload);
        } finally {
          uploadFormRef.value?.setSubmitting?.(false);
        }
      },
      // 成功文案优先用服务端 detail（上传完成提示含文档信息）
      onSuccess: res => {
        message(String(res.detail ?? t("aiKnowledge.uploadDone")), {
          type: "success"
        });
        // 先关弹窗再刷新列表（useDialogForm 内 done 先于回调）
        refresh();
      },
      onFail: res =>
        message(`${t("results.failed")}，${String(res.detail)}`, {
          type: "error"
        })
    });
    addDialog({
      title: t("aiKnowledge.uploadTitle"),
      width: dialogSize("md"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () => h(KnowledgeUploadDialog, { ref: uploadFormRef }),
      beforeSure
    });
  };

  const openKnowledgePanel = (row: KnowledgeRow) => {
    openManageDrawer({
      title: t("aiKnowledge.panelTitle", { title: row.title }),
      size: drawerSize("lg"),
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
