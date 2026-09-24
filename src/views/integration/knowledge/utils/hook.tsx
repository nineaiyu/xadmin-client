import { SUCCESS_CODE } from "@/api/types";
import { h, reactive, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElLink, ElMessageBox, ElTag } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import {
  addDrawer,
  closeDrawer,
  type DrawerOptions
} from "@/components/ReDrawer";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import {
  handleOperation,
  type OperationProps,
  type PageTableColumn
} from "@/components/RePlusPage";
import {
  knowledgeApi,
  type KnowledgeDocumentItem,
  type KnowledgeSyncSummary
} from "@/api/system/knowledge";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import KnowledgeUploadDialog from "../components/KnowledgeUploadDialog.vue";
import KnowledgePanel from "../components/KnowledgePanel.vue";
import { buildKnowledgeActionGroups } from "./knowledgeActions";
import Plus from "~icons/ep/plus";
import Refresh from "~icons/ep/refresh";
import Check from "~icons/ep/check";
import Close from "~icons/ep/close";

type KnowledgeRow = KnowledgeDocumentItem & { is_active: boolean };

/** 行内字典化字段取标量值：后端 LabeledChoice 下发 {value,label}（或原始字符串） */
const dictValue = (value: unknown): string =>
  typeof value === "string"
    ? value
    : ((value as { value?: string })?.value ?? "");

/**
 * 知识库页装配：列表走 RePlusPage 标准 CRUD 口径，行操作收敛进「管理文档」抽屉：
 * - 操作列只留「预览」入口（文档标题同为入口），抽屉内承载全文/分块清单 +
 *   启用/停用（partialUpdate → 分块移除/重建）+ 删除（仅上传文档，分块级联清理）；
 * - 仓库文档：只读（随 `sync-repo`/命令与 docs/ 文件保持一致，抽屉内不出现删除）；
 * - 状态列为只读标签（原框架 el-switch 因 partialUpdate=false 恒禁用，与行内启停
 *   按钮形成"一个能点一个不能点"的重复入口，本次一并清除）。
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

  /* ---------------- 列渲染（入口 + 只读状态） ---------------- */
  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "title":
          // 文档标题同为抽屉入口（预览/启停/删除都在抽屉内）
          column["cellRenderer"] = ({ row }) => {
            const item = row as KnowledgeRow;
            return h(
              ElLink,
              {
                type: "primary",
                onClick: () => openKnowledgePanel(item)
              },
              () => item.title
            );
          };
          break;
        case "is_active":
          // 只读状态标签：启停入口唯一收敛到抽屉（避免与禁用开关并存）
          column["cellRenderer"] = ({ row, props }) => {
            const active = Boolean((row as KnowledgeRow).is_active);
            return h(
              ElTag,
              {
                type: active ? "success" : "danger",
                size: props.size,
                effect: "plain"
              },
              () =>
                active ? t("aiKnowledge.enabled") : t("aiKnowledge.disabled")
            );
          };
          break;
      }
    });
    return columns;
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
    // 行操作收敛进抽屉后操作列只需容纳「预览」一个入口
    width: 140,
    // 文档资料与正文由「管理文档」抽屉承载，关闭框架默认详情入口避免重复
    hideDetail: true,
    buttons: [
      {
        text: t("aiKnowledge.preview"),
        code: "preview",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openKnowledgePanel(row as KnowledgeRow),
        show: 10
      }
    ]
  });

  return {
    api,
    auth,
    listColumnsFormat,
    tableBarButtonsProps,
    operationButtonsProps
  };
}
