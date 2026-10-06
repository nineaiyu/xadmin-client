import { SUCCESS_CODE } from "@/api/types";
import { getCurrentScope, h, onScopeDispose, ref, type Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { openManageDrawer } from "@/components/ReActionPanel";
import { hasAuth } from "@/router/utils";
import { handleOperation } from "@/components/RePlusPage";
import {
  knowledgeApi,
  type KnowledgeSyncStatus,
  type KnowledgeSyncSummary
} from "@/api/ai/knowledge";
import { useConfirm } from "@/hooks/useConfirm";
import { message } from "@/utils/message";
import KnowledgeUploadDialog from "../components/KnowledgeUploadDialog.vue";
import KnowledgePanel from "../components/KnowledgePanel.vue";
import { buildKnowledgeActionGroups } from "./knowledgeActions";
import type { KnowledgeDocumentItem } from "@/api/ai/knowledge";

type KnowledgeRow = KnowledgeDocumentItem & { is_active: boolean };

/** 仓库同步为后台任务：提交后经状态端点轮询终态摘要（与向量构建进度轮询同思路） */
export const SYNC_POLL_INTERVAL = 1500;
export const SYNC_POLL_TIMEOUT = 5 * 60 * 1000;

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
  const confirm = useConfirm();

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
    // 异常归一为可读失败结果：启停失败（分块重建被拒等）需给出可读原因
    const res = await knowledgeApi
      .partialUpdate(row.pk, {
        is_active: !row.is_active
      })
      .catch(error => ({
        code: -1,
        detail: String((error as { detail?: string })?.detail ?? error)
      }));
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
    confirm(t("aiKnowledge.deleteConfirm"), {
      title: t("buttons.delete")
    }).then(ok => {
      if (ok) removeDocument(row);
    });
  };

  /** 「管理文档」抽屉：资料 + 全文/分块 + 启停/删除动作（行操作唯一入口） */
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

  /** 仓库同步轮询定时器：挂当前作用域，组件卸载即清理，避免卸载后仍轮询/弹消息 */
  let syncPollTimer: ReturnType<typeof setTimeout> | null = null;
  const stopSyncPolling = () => {
    if (syncPollTimer) {
      clearTimeout(syncPollTimer);
      syncPollTimer = null;
    }
  };
  if (getCurrentScope()) {
    onScopeDispose(stopSyncPolling);
  }

  const waitSyncPollTick = () =>
    new Promise<void>(resolve => {
      syncPollTimer = setTimeout(resolve, SYNC_POLL_INTERVAL);
    });

  /** 轮询仓库同步状态：终态（done/error）或超时停止；卸载后定时器被清理即停 */
  const pollSyncStatus = async () => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < SYNC_POLL_TIMEOUT) {
      await waitSyncPollTick();
      // 异常归一为可读失败结果：状态查询失败按一次无效轮询处理，下轮重试
      const res = await knowledgeApi.syncRepoStatus().catch(error => ({
        code: -1,
        detail: String((error as { detail?: string })?.detail ?? error),
        data: null
      }));
      const status = res.data as KnowledgeSyncStatus | null;
      if (!status || status.state === "running" || status.state === "idle") {
        continue;
      }
      if (status.state === "done") {
        const summary = (status.summary ?? {}) as Partial<KnowledgeSyncSummary>;
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
      return;
    }
    message(t("aiKnowledge.syncPollTimeout"), { type: "warning" });
  };

  const syncRepo = async () => {
    // 异常归一为可读失败结果：提交可能因仓库不可达等失败，需给出可读原因
    const res = await knowledgeApi.syncRepo().catch(error => ({
      code: -1,
      data: null,
      detail: String((error as { detail?: string })?.detail ?? error)
    }));
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

  /** 批量启停：取勾选行 pk，未勾选时按项目既有口径提示 */
  const batchToggle = (isActive: boolean) => async () => {
    const pks = tableRef.value?.getSelectPks("pk") ?? [];
    if (!pks.length) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    // 异常归一为可读失败结果：批量启停失败需给出可读原因
    const res = await knowledgeApi.batchToggle(pks, isActive).catch(error => ({
      code: -1,
      data: null,
      detail: String((error as { detail?: string })?.detail ?? error)
    }));
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
