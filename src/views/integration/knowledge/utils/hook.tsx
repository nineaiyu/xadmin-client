import { h, reactive, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElLink, ElTag } from "element-plus";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import {
  formatPageColumns,
  type OperationProps,
  type PageTableColumn
} from "@/components/RePlusPage";
import { knowledgeApi } from "@/api/ai/knowledge";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Plus from "~icons/ep/plus";
import Refresh from "~icons/ep/refresh";
import Check from "~icons/ep/check";
import Close from "~icons/ep/close";
import { useKnowledgeActions } from "./useKnowledgeActions";
import { useKnowledgeBuild } from "./useKnowledgeBuild";
import type { KnowledgeDocumentItem } from "@/api/ai/knowledge";

type KnowledgeRow = KnowledgeDocumentItem & { is_active: boolean };

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
 *
 * 职责拆分：
 * - useKnowledgeActions  上传弹窗、启停/删除、仓库同步、批量启停与管理抽屉；
 * - useKnowledgeBuild    向量索引构建与进度轮询（findMilestone 为纯函数）。
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
  const canSync = hasAuth("syncRepo:AiKnowledge");
  const canBatchToggle = hasAuth("batchToggle:AiKnowledge");
  const canBuildEmbeddings = hasAuth("buildEmbeddings:AiKnowledge");
  // 批量删除走框架内建入口（勾选行后工具栏出现），由 auth.batchDestroy 控制显示，
  // 后端 batch-destroy 只删上传文档并清理分块
  const api = reactive(knowledgeApi);

  const refresh = () => tableRef.value?.handleGetData();

  const { openUpload, openKnowledgePanel, syncRepo, batchToggle } =
    useKnowledgeActions({ t, tableRef });

  const { buildEmbeddings } = useKnowledgeBuild({ t, refresh });

  /* ---------------- 列渲染（入口 + 只读状态） ---------------- */
  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      title: column => {
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
      },
      is_active: column => {
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
      }
    });

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
        text: t("aiKnowledge.buildEmbeddings"),
        code: "buildEmbeddings",
        props: { icon: useRenderIcon("ep/magic-stick") },
        onClick: buildEmbeddings,
        show: canBuildEmbeddings
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
