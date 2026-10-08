import { h, type UnwrapNestedRefs } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import type { deptApi } from "@/api/system/dept";
import { handleShowChangeHistory } from "@/components/RePlusPage";
import { addDrawer } from "@/components/ReDrawer";
import {
  PanelProfile,
  ReActionPanel,
  bindRowGroups,
  openManageDrawer
} from "@/components/ReActionPanel";
import DeptPermissionPreview from "../components/DeptPermissionPreview.vue";
import { buildDeptActionGroups, type DeptActionAuth } from "./deptActions";
import { buildDeptMetaItems, buildDeptProfileData } from "./deptPanel";
import type { DeptRow } from "./types";

/**
 * 部门抽屉：授权预览与行内「管理」入口（自 utils/hook 拆出，行为不变）。
 *
 * 动作执行前先收起抽屉再打开二级弹层（避免抽屉与弹窗叠加、焦点归属混乱），
 * 分组与显隐由 buildDeptActionGroups 统一裁决，面板渲染走 ReActionPanel
 * 通用模板（资料卡数据与基础信息由 deptPanel 从行快照构建）。
 */
export function useDeptPanel({
  api,
  auth,
  handleRoleRules,
  openManagers,
  onGoDetail
}: {
  api: UnwrapNestedRefs<typeof deptApi>;
  auth: DeptActionAuth;
  handleRoleRules: (row: DeptRow) => void;
  openManagers: (row: DeptRow) => void;
  onGoDetail: (row: DeptRow) => void;
}) {
  const { t } = useI18n();

  /** 部门授权预览抽屉（挂载角色 / 数据权限 / 字段权限 / 成员采样；统一走 ReDrawer） */
  const openPreview = (row: DeptRow) => {
    addDrawer({
      title: t("permissionPreview.deptTitle"),
      size: "70%",
      destroyOnClose: true,
      hideFooter: true,
      contentRenderer: () => h(DeptPermissionPreview, { row })
    });
  };

  function openDeptPanel(row: DeptRow) {
    openManageDrawer({
      title: t("systemDept.manageDept", { dept: row.name }),
      render: ({ withClosed }) =>
        h(
          ReActionPanel,
          {
            metaItems: buildDeptMetaItems(row, t),
            groups: bindRowGroups(
              buildDeptActionGroups({
                t,
                auth,
                flags: {
                  viewMembers: hasAuth("list:SystemUser")
                },
                handlers: {
                  assignRoles: withClosed(handleRoleRules),
                  assignManagers: withClosed(openManagers),
                  preview: withClosed(openPreview),
                  viewMembers: withClosed(onGoDetail),
                  changeHistory: withClosed(target =>
                    handleShowChangeHistory({ t, api, row: target })
                  )
                }
              }),
              row
            )
          },
          {
            profile: () =>
              h(PanelProfile, { profile: buildDeptProfileData(row, t) })
          }
        )
    });
  }

  return { openDeptPanel };
}
