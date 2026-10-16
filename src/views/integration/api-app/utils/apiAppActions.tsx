import type { useI18n } from "vue-i18n";
import type {
  PanelActionGroup,
  PanelActionItem
} from "@/components/ReActionPanel";

import Stats from "~icons/ri/bar-chart-2-line";
import Key from "~icons/ri/key-2-line";
import SendPlane from "~icons/ri/send-plane-line";
import Settings from "~icons/ri/settings-3-line";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 页面级权限：缺权限的动作在构建期剔除（后端仍按请求路径复核） */
export interface ApiAppActionFlags {
  canStats?: boolean;
  canRegenerate?: boolean;
  canTestCallback?: boolean;
  canEdit?: boolean;
}

export interface ApiAppActionHandlers {
  openUsage: () => void;
  regenerate: () => void;
  testCallback: () => void;
  edit: () => void;
}

/** 动作收集：上下文类型收敛字面量，并剔除无权限（false/undefined）项 */
const collect = (
  ...items: Array<PanelActionItem | false | undefined>
): PanelActionItem[] =>
  items.filter((item): item is PanelActionItem => Boolean(item));

/**
 * API 应用抽屉动作清单：按「接入 → 联调 → 配置」分组，权限缺失的动作与随之变空的
 * 分组一并剔除。纯函数便于用显隐矩阵单测覆盖（不依赖组件挂载）。
 */
export function buildApiAppActionGroups({
  t,
  flags,
  handlers
}: {
  t: TFunction;
  flags: ApiAppActionFlags;
  handlers: ApiAppActionHandlers;
}): PanelActionGroup[] {
  const groups: PanelActionGroup[] = [
    {
      key: "access",
      title: t("apiApp.actionGroups.access"),
      actions: collect(
        flags.canStats && {
          code: "usage",
          label: t("apiApp.usage.title"),
          description: t("apiApp.usageDesc"),
          icon: Stats,
          run: handlers.openUsage
        },
        flags.canRegenerate && {
          code: "regenerate",
          label: t("apiApp.regenerate"),
          description: t("apiApp.regenerateDesc"),
          icon: Key,
          // 高危：旧 client_secret 立即失效，第三方集成需同步更新（执行前二次确认）
          type: "warning",
          run: handlers.regenerate
        }
      )
    },
    {
      key: "verify",
      title: t("apiApp.actionGroups.verify"),
      actions: collect(
        flags.canTestCallback && {
          code: "testCallback",
          label: t("apiApp.testCallback"),
          description: t("apiApp.testCallbackDesc"),
          icon: SendPlane,
          run: handlers.testCallback
        }
      )
    },
    {
      key: "manage",
      title: t("apiApp.actionGroups.manage"),
      actions: collect(
        flags.canEdit && {
          code: "edit",
          label: t("apiApp.edit"),
          description: t("apiApp.editDesc"),
          icon: Settings,
          run: handlers.edit
        }
      )
    }
  ];

  return groups.filter(group => group.actions.length > 0);
}
