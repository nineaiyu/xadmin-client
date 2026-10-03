import type { Component } from "vue";
import type { useI18n } from "vue-i18n";

import Role from "~icons/ri/admin-line";
import Team from "~icons/ri/team-line";
import View from "~icons/ri/eye-line";
import Manager from "~icons/ri/shield-keyhole-line";
import History from "~icons/ri/file-list-3-line";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 动作语义色：本页动作均为配置类（无不可逆/中断会话项），类型与用户面板同构预留 */
export type DeptActionType = "primary" | "warning" | "danger";

/** 面板内单个动作：页面级权限在构建期收敛，行级可用性由 disabled 判定 */
export interface DeptActionItem {
  code: string;
  label: string;
  description?: string;
  icon: Component;
  type?: DeptActionType;
  disabled?: (row: Record<string, unknown>) => boolean;
  run: (row: Record<string, unknown>) => void;
}

export interface DeptActionGroup {
  key: string;
  title: string;
  actions: DeptActionItem[];
}

/** 动作所需的页面权限键（usePageAuth 的声明同源） */
export interface DeptActionAuth {
  empower?: boolean;
  assignManagers?: boolean;
  preview?: boolean;
  changeHistory?: boolean;
}

/** 跨模块权限：跳转用户列表查看部门成员（非本页权限点，逐项单判） */
export interface DeptActionFlags {
  viewMembers?: boolean;
}

export interface DeptActionHandlers {
  assignRoles: (row: Record<string, unknown>) => void;
  assignManagers: (row: Record<string, unknown>) => void;
  preview: (row: Record<string, unknown>) => void;
  viewMembers: (row: Record<string, unknown>) => void;
  changeHistory: (row: Record<string, unknown>) => void;
}

/** 动作收集：上下文类型收敛字面量，并剔除无权限（false/undefined）项 */
const collect = (
  ...items: Array<DeptActionItem | false | undefined>
): DeptActionItem[] =>
  items.filter((item): item is DeptActionItem => Boolean(item));

/**
 * 部门管理动作清单：面板按分组渲染，权限缺失的动作与随之变空的分组一并剔除。
 * 行内原「分配角色权限 / 部门管理员 / 权限预览」三入口与变更历史统一收敛进抽屉。
 * 纯函数便于用显隐矩阵单测覆盖（不依赖组件挂载）。
 */
export function buildDeptActionGroups({
  t,
  auth,
  flags,
  handlers
}: {
  t: TFunction;
  auth: DeptActionAuth;
  flags: DeptActionFlags;
  handlers: DeptActionHandlers;
}): DeptActionGroup[] {
  const groups: DeptActionGroup[] = [
    {
      key: "permission",
      title: t("systemDept.actionGroups.permission"),
      actions: collect(
        auth.empower && {
          code: "empower",
          label: t("systemDept.assignRoles"),
          description: t("systemDept.assignRolesTip"),
          icon: Role,
          run: handlers.assignRoles
        },
        auth.preview && {
          code: "preview",
          label: t("systemDept.preview"),
          description: t("systemDept.previewTip"),
          icon: View,
          run: handlers.preview
        }
      )
    },
    {
      key: "member",
      title: t("systemDept.actionGroups.member"),
      actions: collect(
        auth.assignManagers && {
          code: "assignManagers",
          label: t("systemDept.managers"),
          description: t("systemDept.assignManagersTip"),
          icon: Manager,
          run: handlers.assignManagers
        },
        flags.viewMembers && {
          code: "viewMembers",
          label: t("systemDept.viewMembers"),
          description: t("systemDept.viewMembersTip"),
          icon: Team,
          // 无成员时跳转无意义（与行内人数链接同一口径）
          disabled: (row: Record<string, unknown>) =>
            Number(row?.user_count ?? 0) === 0,
          run: handlers.viewMembers
        }
      )
    },
    {
      key: "record",
      title: t("systemDept.actionGroups.record"),
      actions: collect(
        auth.changeHistory && {
          code: "changeHistory",
          label: t("buttons.changeHistory"),
          description: t("systemDept.changeHistoryTip"),
          icon: History,
          run: handlers.changeHistory
        }
      )
    }
  ];

  return groups.filter(group => group.actions.length > 0);
}
