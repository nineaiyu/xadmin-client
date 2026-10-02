import { SUCCESS_CODE } from "@/api/types";
import { h, ref, type Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { ElMessageBox } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import {
  addDrawer,
  closeDrawer,
  type DrawerOptions
} from "@/components/ReDrawer";
import { hasAuth } from "@/router/utils";
import { handleOperation } from "@/components/RePlusPage";
import { knowledgeApi, type KnowledgeSyncSummary } from "@/api/ai/knowledge";
import { message } from "@/utils/message";
import KnowledgeUploadDialog from "../components/KnowledgeUploadDialog.vue";
import KnowledgePanel from "../components/KnowledgePanel.vue";
import { buildKnowledgeActionGroups } from "./knowledgeActions";
import type { KnowledgeDocumentItem } from "@/api/ai/knowledge";

type KnowledgeRow = KnowledgeDocumentItem & { is_active: boolean };

/** 行内字典化字段取标量值：后端 LabeledChoice 下发 {value,label}（或原始字符串） */
export const dictValue = (value: unknown): string =>
  typeof value === "string"
    ? value
    : ((value as { value?: string })?.value ?? "");

/** 知识库行/工具栏动作：上传弹窗、启停/删除、仓库同步、批量启停与管理抽屉 */
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
          .catch(error => ({
            code: -1,
            detail: String((error as { detail?: string })?.detail ?? error)
          }));
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

  const toggleActive = async (row: KnowledgeRow) => {
    const res = await knowledgeApi.partialUpdate(row.pk, {
      is_active: !row.is_active
    });
    if (res.code === SUCCESS_CODE) {
      message(t("aiKnowledge.toggleDone"), { type: "success" });
      refresh();
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  };

  /** 删除文档（仅上传来源）：分块级联清理，执行前二次确认 */
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
    ElMessageBox.confirm(t("aiKnowledge.deleteConfirm"), t("buttons.delete"), {
      confirmButtonText: t("buttons.sure"),
      cancelButtonText: t("buttons.cancel"),
      type: "warning"
    })
      .then(() => removeDocument(row))
      .catch(() => undefined);
  };

  /** 「管理文档」抽屉：资料 + 全文/分块 + 启停/删除动作（行操作唯一入口） */
  const openKnowledgePanel = (row: KnowledgeRow) => {
    const options: DrawerOptions = {
      title: t("aiKnowledge.panelTitle", { title: row.title }),
      size: "55%",
      destroyOnClose: true,
      closeOnClickModal: false,
      hideFooter: true
    };
    // 状态变更类动作执行前先收起抽屉：抽屉内的状态标签与动作文案基于行快照，
    // 收起后重开即为最新状态（同时避免与确认弹窗叠加）
    const withClosed = (run: () => void) => () => {
      closeDrawer(options, 0);
      run();
    };
    options.contentRenderer = () =>
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
            toggle: withClosed(() => toggleActive(row)),
            remove: withClosed(() => confirmRemove(row))
          }
        })
      });
    addDrawer(options);
  };

  const syncRepo = async () => {
    const res = await knowledgeApi.syncRepo();
    if (res.code === SUCCESS_CODE) {
      const summary = (res.data ?? {}) as KnowledgeSyncSummary;
      message(
        t("aiKnowledge.syncDone", {
          created: summary.created ?? 0,
          updated: summary.updated ?? 0,
          removed: summary.removed ?? 0
        }),
        { type: "success" }
      );
      refresh();
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  };

  /** 批量启停：取勾选行 pk，未勾选时按项目既有口径提示 */
  const batchToggle = (isActive: boolean) => async () => {
    const pks = tableRef.value?.getSelectPks("pk") ?? [];
    if (!pks.length) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    const res = await knowledgeApi.batchToggle(pks, isActive);
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
