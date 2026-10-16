import { reactive, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth, usePageAuth } from "@/router/utils";
import { knowledgeApi } from "@/api/ai/knowledge";
import { useKnowledgeActions } from "./useKnowledgeActions";
import { useKnowledgeBuild } from "./useKnowledgeBuild";
import { useKnowledgeColumns } from "./useKnowledgeColumns";
import { useKnowledgeButtons } from "./useKnowledgeButtons";

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
 * - useKnowledgeBuild    向量索引构建与进度轮询（findMilestone 为纯函数）；
 * - useKnowledgeColumns  列渲染；
 * - useKnowledgeButtons  工具栏与行操作按钮装配。
 */
export function useKnowledge(tableRef: Ref) {
  const { t } = useI18n();
  const auth = usePageAuth("AiKnowledge");
  auth.create = false;
  auth.update = false;
  auth.partialUpdate = false;
  auth.destroy = false;
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

  const { listColumnsFormat } = useKnowledgeColumns({ t, openKnowledgePanel });

  const { tableBarButtonsProps, operationButtonsProps } = useKnowledgeButtons({
    t,
    flags: { canCreate, canSync, canBatchToggle, canBuildEmbeddings },
    openUpload,
    syncRepo,
    buildEmbeddings,
    batchToggle,
    openKnowledgePanel
  });

  return {
    api,
    auth,
    listColumnsFormat,
    tableBarButtonsProps,
    operationButtonsProps
  };
}
