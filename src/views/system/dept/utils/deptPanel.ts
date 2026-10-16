import type { useI18n } from "vue-i18n";
import {
  toDisplayList,
  toDisplayText,
  type PanelMetaItem,
  type PanelProfileData,
  type PanelStatusTag
} from "@/components/ReActionPanel";
import { formatDateTime } from "@/utils";
import type { DeptRow } from "./types";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 状态标签：启用状态 / 注册自动绑定（行快照构建，零额外请求） */
function buildDeptStatusTags(row: DeptRow, t: TFunction): PanelStatusTag[] {
  const result: PanelStatusTag[] = [];
  const active = row.is_active;
  if (active !== undefined && active !== null) {
    result.push({
      key: "is_active",
      text: active ? t("systemUser.enabled") : t("systemUser.disabled"),
      type: active ? "success" : "danger"
    });
  }
  if (row.auto_bind) {
    result.push({
      key: "auto_bind",
      text: t("systemDept.auto_bind"),
      type: "primary"
    });
  }
  return result;
}

/** 部门「管理」抽屉资料卡数据：PanelProfile 渲染契约 */
export function buildDeptProfileData(
  row: DeptRow,
  t: TFunction
): PanelProfileData {
  const displayName =
    toDisplayText(row.name) === "—" ? t("systemDept.dept") : String(row.name);
  return {
    name: displayName,
    subtitle: toDisplayText(row.code) === "—" ? undefined : String(row.code),
    badgeText: displayName.slice(0, 1),
    statusTags: buildDeptStatusTags(row, t),
    tagRows: [
      {
        key: "managers",
        caption: t("systemDept.managers"),
        items: toDisplayList(row.managers)
      },
      {
        key: "roles",
        caption: t("systemDept.roles"),
        items: toDisplayList(row.roles).map(item => ({
          ...item,
          type: "info" as const
        }))
      }
    ]
  };
}

/** 部门「管理」抽屉基础信息（两列网格） */
export function buildDeptMetaItems(
  row: DeptRow,
  t: TFunction
): PanelMetaItem[] {
  const userCount = Number(row.user_count ?? 0);
  return [
    {
      key: "code",
      label: t("systemDept.code"),
      value: toDisplayText(row.code)
    },
    {
      key: "parent",
      label: t("systemDept.parent"),
      value: toDisplayText(row.parent)
    },
    {
      key: "leader",
      label: t("permissionPreview.deptLeader"),
      value: toDisplayText(row.leader)
    },
    {
      key: "user_count",
      label: t("systemDept.user_count"),
      value: userCount ? String(userCount) : "—"
    },
    {
      key: "created_time",
      label: t("commonLabels.created_time"),
      value: formatDateTime(row.created_time) || "—"
    },
    {
      key: "description",
      label: t("commonLabels.description"),
      value: toDisplayText(row.description)
    }
  ];
}
