import type { RecordType } from "plus-pro-components";
import type { useI18n } from "vue-i18n";
import {
  toDisplayList,
  toDisplayText,
  type PanelMetaItem,
  type PanelProfileData,
  type PanelStatusTag
} from "@/components/ReActionPanel";
import { choiceValue } from "@/utils/dict";
import { formatDateTime } from "@/utils";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 状态标签：启用状态 / 锁定 / 在线会话 / 邀请状态（行快照构建，零额外请求） */
function buildUserStatusTags(row: RecordType, t: TFunction): PanelStatusTag[] {
  const result: PanelStatusTag[] = [];
  const active = row.is_active;
  if (active !== undefined && active !== null) {
    result.push({
      key: "is_active",
      text: active ? t("systemUser.enabled") : t("systemUser.disabled"),
      type: active ? "success" : "danger"
    });
  }
  if (row.block) {
    result.push({ key: "block", text: t("systemUser.locked"), type: "danger" });
  }
  const online = Number(row.online_count ?? 0);
  if (online > 0) {
    result.push({
      key: "online",
      text: t("systemUser.onlineSessions", { count: online }),
      type: "primary"
    });
  }
  const invite = choiceValue(row.invite_status);
  if (invite) {
    result.push({
      key: "invite",
      text:
        row.invite_status?.label ??
        t(
          invite === "pending"
            ? "systemUser.invitePending"
            : "systemUser.inviteAccepted"
        ),
      type: invite === "pending" ? "warning" : "success"
    });
  }
  return result;
}

/** 用户「管理」抽屉资料卡数据：PanelProfile 渲染契约 */
export function buildUserProfileData(
  row: RecordType,
  t: TFunction
): PanelProfileData {
  const displayName = row.nickname || row.username || t("systemUser.user");
  return {
    name: String(displayName),
    subtitle: row.username ? `@${row.username}` : undefined,
    avatar: typeof row.avatar === "string" ? row.avatar : undefined,
    badgeText: String(displayName).slice(0, 1),
    shape: "circle",
    statusTags: buildUserStatusTags(row, t),
    tagRows: [
      {
        key: "roles",
        caption: t("systemUser.roles"),
        items: toDisplayList(row.roles)
      },
      {
        key: "tags",
        caption: t("systemUser.tags"),
        items: toDisplayList(row.tags)
      }
    ]
  };
}

/** 用户「管理」抽屉基础信息（两列网格） */
export function buildUserMetaItems(
  row: RecordType,
  t: TFunction
): PanelMetaItem[] {
  return [
    {
      key: "dept",
      label: t("systemUser.dept"),
      value: toDisplayText(row.dept)
    },
    {
      key: "phone",
      label: t("systemUser.phone"),
      value: toDisplayText(row.phone)
    },
    {
      key: "email",
      label: t("systemUser.email"),
      value: toDisplayText(row.email)
    },
    {
      key: "date_joined",
      label: t("systemUser.date_joined"),
      value: formatDateTime(row.date_joined) || "—"
    },
    {
      key: "last_login",
      label: t("systemUser.last_login"),
      value: formatDateTime(row.last_login) || "—"
    },
    {
      key: "date_expired",
      label: t("systemUser.dateExpired"),
      value: formatDateTime(row.date_expired) || "—"
    }
  ];
}
