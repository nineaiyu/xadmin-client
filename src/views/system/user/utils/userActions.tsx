import type { Component } from "vue";
import type { RecordType } from "plus-pro-components";
import type { useI18n } from "vue-i18n";

import Role from "~icons/ri/admin-line";
import Avatar from "~icons/ri/user-3-fill";
import Password from "~icons/ri/lock-password-line";
import MailSendLine from "~icons/ri/mail-send-line";
import ShieldKeyhole from "~icons/ri/shield-keyhole-line";
import Message from "~icons/ri/message-fill";
import Tag from "~icons/ri/price-tag-3-line";
import Logout from "~icons/ri/logout-circle-r-line";
import Bell from "~icons/ri/notification-3-line";
import History from "~icons/ri/file-list-3-line";
import View from "~icons/ep/view";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 动作语义色：danger 高危（中断会话/不可逆）、warning 需谨慎、primary 常规 */
export type UserActionType = "primary" | "warning" | "danger";

/** 面板内单个动作：页面级权限在构建期收敛，行级可用性由 disabled 判定 */
export interface UserActionItem {
  code: string;
  label: string;
  description?: string;
  icon: Component;
  type?: UserActionType;
  disabled?: (row: RecordType) => boolean;
  run: (row: RecordType) => void;
}

export interface UserActionGroup {
  key: string;
  title: string;
  actions: UserActionItem[];
}

/** 动作所需的页面权限键（与 getDefaultAuths 的声明同源） */
export interface UserActionAuth {
  logout?: boolean;
  upload?: boolean;
  resetPassword?: boolean;
  empower?: boolean;
  resetMfa?: boolean;
  preview?: boolean;
  imBinding?: boolean;
  invite?: boolean;
  changeHistory?: boolean;
}

/** 跨模块权限：通知创建与标签授予（非本页权限点，逐项单判） */
export interface UserActionFlags {
  sendNotice?: boolean;
  assignTags?: boolean;
}

export interface UserActionHandlers {
  resetPassword: (row: RecordType) => void;
  uploadAvatar: (row: RecordType) => void;
  resetMfa: (row: RecordType) => void;
  logout: (row: RecordType) => void;
  assignRoles: (row: RecordType) => void;
  preview: (row: RecordType) => void;
  invite: (row: RecordType) => void;
  sendNotice: (row: RecordType) => void;
  imBinding: (row: RecordType) => void;
  assignTags: (row: RecordType) => void;
  changeHistory: (row: RecordType) => void;
}

/** 动作收集：上下文类型收敛字面量，并剔除无权限（false/undefined）项 */
const collect = (
  ...items: Array<UserActionItem | false | undefined>
): UserActionItem[] =>
  items.filter((item): item is UserActionItem => Boolean(item));

/**
 * 用户管理动作清单：面板按分组渲染，权限缺失的动作与随之变空的分组一并剔除。
 * 纯函数便于用显隐矩阵单测覆盖（不依赖组件挂载）。
 */
export function buildUserActionGroups({
  t,
  auth,
  flags,
  handlers
}: {
  t: TFunction;
  auth: UserActionAuth;
  flags: UserActionFlags;
  handlers: UserActionHandlers;
}): UserActionGroup[] {
  const groups: UserActionGroup[] = [
    {
      key: "account",
      title: t("systemUser.actionGroups.account"),
      actions: collect(
        auth.resetPassword && {
          code: "resetPassword",
          label: t("systemUser.resetPassword"),
          description: t("systemUser.resetPasswordTip"),
          icon: Password,
          run: handlers.resetPassword
        },
        auth.resetMfa && {
          code: "resetMfa",
          label: t("systemUser.resetMfa"),
          description: t("systemUser.resetMfaTip"),
          icon: ShieldKeyhole,
          type: "warning",
          run: handlers.resetMfa
        },
        auth.upload && {
          code: "upload",
          label: t("systemUser.editAvatar"),
          description: t("systemUser.editAvatarTip"),
          icon: Avatar,
          run: handlers.uploadAvatar
        },
        auth.logout && {
          code: "logout",
          label: t("systemUser.logout"),
          description: t("systemUser.logoutTip"),
          icon: Logout,
          type: "danger",
          // 无在线会话时不可用（与行内按钮同一口径）
          disabled: (row: RecordType) => Number(row?.online_count ?? 0) === 0,
          run: handlers.logout
        }
      )
    },
    {
      key: "permission",
      title: t("systemUser.actionGroups.permission"),
      actions: collect(
        auth.empower && {
          code: "empower",
          label: t("systemUser.assignRoles"),
          description: t("systemUser.assignRolesTip"),
          icon: Role,
          run: handlers.assignRoles
        },
        auth.preview && {
          code: "preview",
          label: t("systemUser.preview"),
          description: t("systemUser.previewTip"),
          icon: View,
          run: handlers.preview
        }
      )
    },
    {
      key: "lifecycle",
      title: t("systemUser.actionGroups.lifecycle"),
      actions: collect(
        auth.invite && {
          code: "invite",
          label: t("systemUser.invite"),
          description: t("systemUser.inviteTip"),
          icon: MailSendLine,
          type: "warning",
          run: handlers.invite
        }
      )
    },
    {
      key: "collaboration",
      title: t("systemUser.actionGroups.collaboration"),
      actions: collect(
        flags.sendNotice && {
          code: "sendNotice",
          label: t("systemUser.sendNotice"),
          description: t("systemUser.sendNoticeTip"),
          icon: Bell,
          run: handlers.sendNotice
        },
        auth.imBinding && {
          code: "imBinding",
          label: t("systemUser.imBinding"),
          description: t("systemUser.imBindingTip"),
          icon: Message,
          run: handlers.imBinding
        },
        flags.assignTags && {
          code: "tags",
          label: t("tag.assignTitle"),
          description: t("systemUser.tagsTip"),
          icon: Tag,
          run: handlers.assignTags
        }
      )
    },
    {
      key: "record",
      title: t("systemUser.actionGroups.record"),
      actions: collect(
        auth.changeHistory && {
          code: "changeHistory",
          label: t("buttons.changeHistory"),
          description: t("systemUser.changeHistoryTip"),
          icon: History,
          run: handlers.changeHistory
        }
      )
    }
  ];

  return groups.filter(group => group.actions.length > 0);
}
