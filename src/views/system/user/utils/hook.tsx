import "./reset.css";
import { reactive, ref, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { userApi } from "@/api/identity/user";
import { usePageAuth } from "@/router/utils";
import { usePublicHooks } from "@/components/RePlusPage";
import { deviceDetection } from "@pureadmin/utils";
import { useUserOptions } from "./useUserOptions";
import { useUserAvatarUpload } from "./useUserAvatarUpload";
import { useUserResetPassword } from "./useUserResetPassword";
import { useUserColumnFormats } from "./useUserColumnFormats";
import { useUserButtons } from "./useUserButtons";
import { useUserImBinding } from "./useUserImBinding";
import { useUserRowHandlers } from "./useUserRowHandlers";
import { useUserPanel } from "./useUserPanel";
import { useUserPasswordRules } from "./useUserPasswordRules";
import { useTagAssign } from "@/views/system/components/useTagAssign";
import { TAGGABLE_RESOURCE } from "@/api/system/tag";

/**
 * 用户视图组装入口：
 * - useUserOptions        部门树/角色/数据权限选项
 * - useUserAvatarUpload   头像裁剪上传
 * - useUserResetPassword  重置密码 + 强度评分
 * - useUserColumnFormats  列渲染与新增/编辑表单格式化（头像/用户名是抽屉入口）
 * - useUserButtons        工具栏批量按钮与操作列「管理」入口
 * - useUserRowHandlers    行级动作（重置 MFA/下线/通知/邀请/模拟用户）
 * - useUserPanel          用户抽屉（动作分组与资料卡，见 userPanel.ts / userActions.tsx）
 */
export function useUser(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(userApi);

  const auth = usePageAuth([
    "resetPassword",
    "empower",
    "logout",
    "unblock",
    "resetMfa",
    "preview",
    "changeHistory",
    "imBinding",
    "invite",
    "impersonate"
  ]);
  const switchLoadMap = ref({});
  const { switchStyle } = usePublicHooks();
  // 全局密码规则（重置密码与新增/编辑表单校验共用）
  const { passwordRules } = useUserPasswordRules({ t });

  const { treeData, treeLoading, onTreeSelect } = useUserOptions(tableRef);
  const { handleUpload } = useUserAvatarUpload({ t, api, tableRef });
  const { handleReset } = useUserResetPassword({ t, api, passwordRules });
  const { handleImBinding } = useUserImBinding({ t });
  // 通用标签：行内打标（单对象全量替换）与工具栏批量打标共用同一弹窗
  const { openTagDialog } = useTagAssign(tableRef);
  const handlers = useUserRowHandlers({ t, api, tableRef });

  // 抽屉先装配：角色授权入口以 getter 延迟取用（列装配完成后才会被点击）
  const { openUserPanel } = useUserPanel({
    t,
    api,
    auth,
    openTagDialog,
    handlers,
    handleReset,
    handleUpload,
    handleImBinding,
    getHandleRoleRules: () => handleRoleRules
  });

  const {
    listColumnsFormat,
    addOrEditOptions,
    baseColumnsFormat,
    handleRoleRules
  } = useUserColumnFormats({
    t,
    api,
    auth,
    switchLoadMap,
    switchStyle,
    passwordRules,
    tableRef,
    openUserPanel
  });

  const { selectionChange, tableBarButtonsProps, operationButtonsProps } =
    useUserButtons({
      t,
      api,
      tableRef,
      handleBatchTags: pks =>
        openTagDialog({ resource: TAGGABLE_RESOURCE.user, pks }),
      openUserPanel
    });

  // 联动：角色列表「用户数」跳转携带 ?role=<pk> —— 由 RePlusPage 的 routeParams
  // 装配（route.query → 搜索默认值）自动生效，页面无需再注入：首开后二次手动
  // 刷新会覆盖请求序号，导致首开内联元数据被丢弃（表格无列）。

  return {
    api,
    auth,
    treeData,
    treeLoading,
    addOrEditOptions,
    tableBarButtonsProps,
    operationButtonsProps,
    onTreeSelect,
    selectionChange,
    deviceDetection,
    listColumnsFormat,
    baseColumnsFormat,
    openUserPanel
  };
}
