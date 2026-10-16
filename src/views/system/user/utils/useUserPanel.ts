import { h } from "vue";
import { handleShowChangeHistory } from "@/components/RePlusPage";
import {
  PanelProfile,
  ReActionPanel,
  bindRowGroups,
  openManageDrawer
} from "@/components/ReActionPanel";
import { hasAuth } from "@/router/utils";
import { useUserStoreHook } from "@/store/modules/user";
import { TAGGABLE_RESOURCE } from "@/api/system/tag";
import { buildUserActionGroups } from "./userActions";
import { buildUserMetaItems, buildUserProfileData } from "./userPanel";
import { openUserPreview } from "./userPreview";
import type { UnwrapNestedRefs } from "vue";
import type { useI18n } from "vue-i18n";
import type { userApi } from "@/api/identity/user";
import type { RecordType } from "plus-pro-components";
import type { useTagAssign } from "@/views/system/components/useTagAssign";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 用户抽屉依赖：行级动作与弹窗编排由调用方注入（见 hook.tsx 装配顺序） */
type UserPanelDeps = {
  t: TFunction;
  api: UnwrapNestedRefs<typeof userApi>;
  auth: Record<string, boolean | undefined>;
  openTagDialog: ReturnType<typeof useTagAssign>["openTagDialog"];
  handlers: {
    handleResetMfa: (row: RecordType) => void;
    handleLogout: (row: RecordType) => void;
    handleSendNotice: (row: RecordType) => void;
    handleInvite: (row: RecordType) => void;
    handleImpersonate: (row: RecordType) => void;
  };
  handleReset: (row: RecordType) => void;
  handleUpload: (row: RecordType) => void;
  handleImBinding: (row: RecordType) => void;
  /** 角色授权入口由列装配模块提供，装配期晚于本模块 → 以 getter 延迟取用 */
  getHandleRoleRules: () => (row: RecordType) => void;
};

/**
 * 用户管理抽屉：行内头像/用户名与操作列「管理」共用入口。动作执行前先收起
 * 抽屉再打开二级弹层；分组与显隐由 buildUserActionGroups 统一裁决，面板渲染
 * 走 ReActionPanel 通用模板（资料卡数据由 userPanel 从行快照构建）。
 */
export function useUserPanel({
  t,
  api,
  auth,
  openTagDialog,
  handlers,
  handleReset,
  handleUpload,
  handleImBinding,
  getHandleRoleRules
}: UserPanelDeps) {
  function openUserPanel(row: RecordType) {
    openManageDrawer({
      title: t("systemUser.manageUser", { user: row.username }),
      render: ({ withClosed }) =>
        h(
          ReActionPanel,
          {
            metaItems: buildUserMetaItems(row, t),
            groups: bindRowGroups(
              buildUserActionGroups({
                t,
                auth,
                flags: {
                  sendNotice: hasAuth("create:SystemNotice"),
                  assignTags: hasAuth("assign:Tag")
                },
                currentUsername: useUserStoreHook().username,
                handlers: {
                  resetPassword: withClosed(handleReset),
                  uploadAvatar: withClosed(handleUpload),
                  resetMfa: withClosed(handlers.handleResetMfa),
                  logout: withClosed(handlers.handleLogout),
                  assignRoles: withClosed(target =>
                    getHandleRoleRules()(target)
                  ),
                  preview: withClosed(target =>
                    openUserPreview({ t, row: target })
                  ),
                  invite: withClosed(handlers.handleInvite),
                  sendNotice: withClosed(handlers.handleSendNotice),
                  imBinding: withClosed(handleImBinding),
                  impersonate: withClosed(handlers.handleImpersonate),
                  assignTags: withClosed(target =>
                    openTagDialog({
                      resource: TAGGABLE_RESOURCE.user,
                      row: target
                    })
                  ),
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
              h(PanelProfile, { profile: buildUserProfileData(row, t) })
          }
        )
    });
  }

  return { openUserPanel };
}
