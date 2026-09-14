import { SUCCESS_CODE } from "@/api/types";
import { h, reactive, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { addDrawer } from "@/components/ReDrawer";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { handleOperation, type OperationProps } from "@/components/RePlusPage";
import {
  knowledgeApi,
  type KnowledgeDocumentItem,
  type KnowledgeSyncSummary
} from "@/api/system/knowledge";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import KnowledgeUploadDialog from "../components/KnowledgeUploadDialog.vue";
import KnowledgePreview from "../components/KnowledgePreview.vue";
import Plus from "~icons/ep/plus";
import Refresh from "~icons/ep/refresh";
import Delete from "~icons/ep/delete";
import Check from "~icons/ep/check";
import Close from "~icons/ep/close";

type KnowledgeRow = KnowledgeDocumentItem & { is_active: boolean };

/** 行内字典化字段取标量值：后端 LabeledChoice 下发 {value,label}（或原始字符串） */
const dictValue = (value: unknown): string =>
  typeof value === "string"
    ? value
    : ((value as { value?: string })?.value ?? "");

/**
 * 知识库页装配：列表走 RePlusPage 标准 CRUD 口径，操作列按来源分化：
 * - 上传文档：启用/停用（partialUpdate → 分块移除/重建）+ 删除（分块级联清理）；
 * - 仓库文档：只读（随 `sync-repo`/命令与 docs/ 文件保持一致，删除入口不出现）；
 * - 预览：抽屉展示全文 + 分块清单（问答检索命中的最小单元）。
 *
 * 默认按钮裁剪：create/update/partialUpdate/destroy 全部关闭走自定义按钮
 * （标准表单与上传文本/启停语义不符；默认删除按钮无法按行隐藏，统一自定义）。
 */
export function useKnowledge(tableRef: Ref) {
  const { t } = useI18n();
  const baseAuth = getDefaultAuths("AiKnowledge");
  const auth = reactive({
    ...baseAuth,
    create: false,
    update: false,
    partialUpdate: false,
    destroy: false
  });
  const canCreate = hasAuth("create:AiKnowledge");
  const canUpdate = hasAuth("partialUpdate:AiKnowledge");
  const canDestroy = hasAuth("destroy:AiKnowledge");
  const canSync = hasAuth("syncRepo:AiKnowledge");
  const canBatchToggle = hasAuth("batchToggle:AiKnowledge");
  // 批量删除走框架内建入口（勾选行后工具栏出现），由 auth.batchDestroy 控制显示，
  // 后端 batch-destroy 只删上传文档并清理分块
  const api = reactive(knowledgeApi);

  const refresh = () => tableRef.value?.handleGetData();

  const openUpload = () => {
    addDialog({
      title: t("aiKnowledge.uploadTitle"),
      width: "640px",
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      hideFooter: true,
      contentRenderer: () => h(KnowledgeUploadDialog, { onSaved: refresh })
    });
  };

  const openPreview = (row: KnowledgeRow) => {
    addDrawer({
      title: `${t("aiKnowledge.previewTitle")} - ${row.title}`,
      size: "55%",
      destroyOnClose: true,
      closeOnClickModal: false,
      hideFooter: true,
      props: { pk: row.pk },
      contentRenderer: () => h(KnowledgePreview)
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

  /** 批量启停：取勾选行 pk，未勾选时按项目既有口径提示 */
  const batchToggle = (isActive: boolean) => async () => {
    const pks = tableRef.value?.getSelectPks("pk") ?? [];
    if (!pks.length) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    const res = await knowledgeApi.batchToggle(pks, isActive);
    if (res.code === SUCCESS_CODE) {
      const changed =
        (res.data as unknown as { changed?: number })?.changed ?? 0;
      message(t("aiKnowledge.batchToggleDone", { count: changed }), {
        type: "success"
      });
      tableRef.value?.onSelectionCancel?.();
      refresh();
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  };

  const syncRepo = async () => {
    const res = await knowledgeApi.syncRepo();
    if (res.code === SUCCESS_CODE) {
      const summary = (res.data ?? {}) as unknown as KnowledgeSyncSummary;
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

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("aiKnowledge.upload"),
        code: "upload",
        props: {
          type: "primary",
          icon: useRenderIcon(Plus)
        },
        onClick: openUpload,
        show: canCreate
      },
      {
        text: t("aiKnowledge.syncRepo"),
        code: "syncRepo",
        props: { icon: useRenderIcon(Refresh) },
        onClick: syncRepo,
        show: canSync
      },
      {
        text: t("aiKnowledge.batchEnable"),
        code: "batchEnable",
        props: { type: "success", plain: true, icon: useRenderIcon(Check) },
        onClick: batchToggle(true),
        show: canBatchToggle
      },
      {
        text: t("aiKnowledge.batchDisable"),
        code: "batchDisable",
        props: { type: "warning", plain: true, icon: useRenderIcon(Close) },
        onClick: batchToggle(false),
        show: canBatchToggle
      }
    ]
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    showNumber: 5,
    width: 260,
    buttons: [
      {
        text: t("aiKnowledge.preview"),
        code: "preview",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openPreview(row as KnowledgeRow),
        show: 10
      },
      {
        // 文本随行状态切换（启用 ⇄ 停用）；停用即移除分块、退出问答检索。
        // 注意 ButtonOperation 约定：text/show 函数第一个位置参数才是行数据
        // （onClick 收的才是 { row, loading } 对象），解构写法会拿到 undefined
        text: row =>
          (row as KnowledgeRow)?.is_active
            ? t("aiKnowledge.disable")
            : t("aiKnowledge.enable"),
        code: "toggleActive",
        props: { type: "info", link: true },
        onClick: ({ row }) => toggleActive(row as KnowledgeRow),
        show: canUpdate && 20
      },
      {
        // 样式与框架默认删除按钮对齐（danger + 删除图标 + link），唯一差异是按
        // 行隐藏：仓库文档不可删（随 docs/ 文件与同步命令维护）
        text: t("buttons.delete"),
        code: "delete",
        show: row =>
          Boolean(
            canDestroy &&
            dictValue((row as KnowledgeRow)?.source_type) === "upload"
          ) && 30,
        confirm: { title: t("aiKnowledge.deleteConfirm") },
        props: {
          type: "danger",
          icon: useRenderIcon(Delete),
          link: true
        },
        onClick: async ({ row, loading }) => {
          loading.value = true;
          handleOperation({
            t,
            apiReq: knowledgeApi.destroy((row as KnowledgeRow).pk),
            success() {
              message(t("aiKnowledge.deleteDone"), { type: "success" });
              refresh();
            },
            requestEnd() {
              loading.value = false;
            }
          });
        }
      }
    ]
  });

  return {
    api,
    auth,
    tableBarButtonsProps,
    operationButtonsProps
  };
}
