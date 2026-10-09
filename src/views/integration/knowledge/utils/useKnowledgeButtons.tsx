import { shallowRef } from "vue";
import type { useI18n } from "vue-i18n";
import type { OperationProps } from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Plus from "~icons/ep/plus";
import Refresh from "~icons/ep/refresh";
import Check from "~icons/ep/check";
import Close from "~icons/ep/close";
import type { KnowledgeRow } from "./useKnowledgeDocument";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 知识库按钮装配（自 knowledge/utils/hook 抽出）：工具栏「上传 / 同步仓库 /
 * 构建向量索引 / 批量启停」（批量删除走框架内建入口）与行操作「预览」。
 */
export function useKnowledgeButtons({
  t,
  flags: { canCreate, canSync, canBatchToggle, canBuildEmbeddings },
  openUpload,
  syncRepo,
  buildEmbeddings,
  batchToggle,
  openKnowledgePanel
}: {
  t: TFunction;
  flags: {
    canCreate: boolean;
    canSync: boolean;
    canBatchToggle: boolean;
    canBuildEmbeddings: boolean;
  };
  openUpload: () => void;
  syncRepo: () => Promise<void>;
  buildEmbeddings: () => Promise<void>;
  batchToggle: (isActive: boolean) => () => Promise<void>;
  openKnowledgePanel: (row: KnowledgeRow) => void;
}) {
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
        index: 10,
        show: true
      }
    ]
  });

  return { tableBarButtonsProps, operationButtonsProps };
}
