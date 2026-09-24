import type { useI18n } from "vue-i18n";
import type {
  PanelActionGroup,
  PanelActionItem
} from "@/components/ReActionPanel";

import Flashlight from "~icons/ri/flashlight-line";
import Eye from "~icons/ri/eye-line";
import Settings from "~icons/ri/settings-3-line";
import Delete from "~icons/ri/delete-bin-6-line";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 页面级权限：缺权限的动作在构建期剔除（后端仍按请求路径复核） */
export interface AiProfileActionFlags {
  canProbe?: boolean;
  canEdit?: boolean;
  canDestroy?: boolean;
}

export interface AiProfileActionHandlers {
  probe: () => void;
  probeVision: () => void;
  edit: () => void;
  remove: () => void;
}

/** 动作收集：上下文类型收敛字面量，并剔除无权限（false/undefined）项 */
const collect = (
  ...items: Array<PanelActionItem | false | undefined>
): PanelActionItem[] =>
  items.filter((item): item is PanelActionItem => Boolean(item));

/**
 * AI 档案抽屉动作清单：能力探测（含多模态）+ 配置 + 危险区删除。
 * 行内只保留在线处置（测试 / 激活 / 停用），低频与破坏性动作收敛进抽屉。
 * 纯函数便于用显隐矩阵单测覆盖（不依赖组件挂载）。
 */
export function buildAiProfileActionGroups({
  t,
  flags,
  handlers
}: {
  t: TFunction;
  flags: AiProfileActionFlags;
  handlers: AiProfileActionHandlers;
}): PanelActionGroup[] {
  const groups: PanelActionGroup[] = [
    {
      key: "probe",
      title: t("aiConfig.actionGroups.probe"),
      actions: collect(
        flags.canProbe && {
          code: "probe",
          label: t("aiConfig.probe"),
          description: t("aiConfig.probeHint"),
          icon: Flashlight,
          run: handlers.probe
        },
        flags.canProbe && {
          code: "probeVision",
          label: t("aiConfig.probeVision"),
          description: t("aiConfig.probeVisionDesc"),
          icon: Eye,
          run: handlers.probeVision
        }
      )
    },
    {
      key: "manage",
      title: t("aiConfig.actionGroups.manage"),
      actions: collect(
        flags.canEdit && {
          code: "edit",
          label: t("aiConfig.edit"),
          description: t("aiConfig.editDesc"),
          icon: Settings,
          run: handlers.edit
        }
      )
    },
    {
      key: "danger",
      title: t("aiConfig.actionGroups.danger"),
      actions: collect(
        flags.canDestroy && {
          code: "delete",
          label: t("buttons.delete"),
          description: t("aiConfig.deleteDesc"),
          icon: Delete,
          type: "danger",
          run: handlers.remove
        }
      )
    }
  ];

  return groups.filter(group => group.actions.length > 0);
}
