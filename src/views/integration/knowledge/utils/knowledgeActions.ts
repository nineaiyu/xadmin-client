import type { useI18n } from "vue-i18n";
import type {
  PanelActionGroup,
  PanelActionItem
} from "@/components/ReActionPanel";

import Enable from "~icons/ep/check";
import Disable from "~icons/ep/close";
import Delete from "~icons/ep/delete";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 页面级权限：缺权限的动作在构建期剔除（后端仍按请求路径复核） */
export interface KnowledgeActionFlags {
  canUpdate?: boolean;
  canDestroy?: boolean;
}

/** 行级上下文：动作文案随生效状态切换，仓库文档不提供删除入口 */
export interface KnowledgeActionTarget {
  isActive: boolean;
  /** 仅上传文档可删（仓库文档随 docs/ 文件与同步命令维护） */
  removable: boolean;
}

export interface KnowledgeActionHandlers {
  toggle: () => void;
  remove: () => void;
}

/** 动作收集：上下文类型收敛字面量，并剔除无权限（false/undefined）项 */
const collect = (
  ...items: Array<PanelActionItem | false | undefined>
): PanelActionItem[] =>
  items.filter((item): item is PanelActionItem => Boolean(item));

/**
 * 知识库文档抽屉动作清单：启停（语义随状态切换）+ 删除（仅上传文档）。
 * 纯函数便于用显隐矩阵单测覆盖（不依赖组件挂载）。
 */
export function buildKnowledgeActionGroups({
  t,
  flags,
  target,
  handlers
}: {
  t: TFunction;
  flags: KnowledgeActionFlags;
  target: KnowledgeActionTarget;
  handlers: KnowledgeActionHandlers;
}): PanelActionGroup[] {
  const groups: PanelActionGroup[] = [
    {
      key: "retrieval",
      title: t("aiKnowledge.actionGroups.retrieval"),
      actions: collect(
        flags.canUpdate && {
          code: "toggleActive",
          label: target.isActive
            ? t("aiKnowledge.disable")
            : t("aiKnowledge.enable"),
          description: target.isActive
            ? t("aiKnowledge.disableDesc")
            : t("aiKnowledge.enableDesc"),
          icon: target.isActive ? Disable : Enable,
          // 停用会移除分块、退出问答检索：按谨慎语义提示
          type: target.isActive ? "warning" : "primary",
          run: handlers.toggle
        }
      )
    },
    {
      key: "danger",
      title: t("aiKnowledge.actionGroups.danger"),
      actions: collect(
        flags.canDestroy &&
          target.removable && {
            code: "delete",
            label: t("buttons.delete"),
            description: t("aiKnowledge.deleteDesc"),
            icon: Delete,
            type: "danger",
            run: handlers.remove
          }
      )
    }
  ];

  return groups.filter(group => group.actions.length > 0);
}
