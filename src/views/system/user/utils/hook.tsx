import "./reset.css";
import { getCurrentInstance, h, onMounted, reactive, ref, type Ref } from "vue";
import { userApi } from "@/api/system/user";
import { getDefaultAuths } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { handleOperation, usePublicHooks } from "@/components/RePlusPage";
import { addDrawer } from "@/components/ReDrawer";
import { deviceDetection } from "@pureadmin/utils";
import { rulesPasswordApi } from "@/api/auth";
import type { PasswordRule } from "@/api/auth";
import type { RecordType } from "plus-pro-components";
import PermissionPreview from "../components/PermissionPreview.vue";

import { useUserOptions } from "./useUserOptions";
import { useUserAvatarUpload } from "./useUserAvatarUpload";
import { useUserResetPassword } from "./useUserResetPassword";
import { useUserColumnFormats } from "./useUserColumnFormats";
import { useUserButtons } from "./useUserButtons";
import { useUserTags } from "./useUserTags";
import { useUserImBinding } from "./useUserImBinding";

/**
 * 用户视图组装入口（拆分自 604 行单体）：
 * - useUserOptions        部门树/角色/数据权限选项
 * - useUserAvatarUpload   头像裁剪上传
 * - useUserResetPassword  重置密码 + 强度评分
 * - useUserColumnFormats  列渲染与新增/编辑表单格式化
 * - useUserButtons        批量通知与行操作按钮组
 * 返回值形状与拆分前一致（index.vue 无需改动）。
 */
export function useUser(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(userApi);

  const auth = reactive({
    unblock: false,
    empower: false,
    logout: false,
    resetPassword: false,
    resetMfa: false,
    preview: false,
    ...getDefaultAuths(getCurrentInstance(), [
      "resetPassword",
      "empower",
      "logout",
      "unblock",
      "resetMfa",
      "preview",
      "changeHistory",
      "imBinding",
      "invite"
    ])
  });
  const switchLoadMap = ref({});
  const { switchStyle } = usePublicHooks();
  const selectedNum = ref(0);
  const manySelectData = ref([]);
  const passwordRules = ref<PasswordRule[]>([]);

  const { treeData, treeLoading, onTreeSelect } = useUserOptions(tableRef);
  const { handleUpload } = useUserAvatarUpload({ t, api, tableRef });
  const { handleReset } = useUserResetPassword({ t, api, passwordRules });
  const { handleImBinding } = useUserImBinding({ t });
  const { openTagDialog } = useUserTags(tableRef);
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
    tableRef
  });
  /** 用户权限预览抽屉（统一走 ReDrawer，不在页面模板手挂 el-drawer） */
  const openPreview = (row: RecordType) => {
    addDrawer({
      title: t("permissionPreview.userTitle"),
      size: "70%",
      destroyOnClose: true,
      hideFooter: true,
      contentRenderer: () => h(PermissionPreview, { row })
    });
  };

  const { selectionChange, tableBarButtonsProps, operationButtonsProps } =
    useUserButtons({
      t,
      api,
      auth,
      tableRef,
      selectedNum,
      manySelectData,
      handleUpload,
      handleReset,
      handleRoleRules,
      handlePreview: row => openPreview(row),
      handleImBinding,
      handleTags: row => openTagDialog(row)
    });

  // 全局密码规则（重置密码与新增/编辑表单校验共用）
  onMounted(() => {
    handleOperation({
      t,
      apiReq: rulesPasswordApi(),
      success(res) {
        passwordRules.value = res?.data?.password_rules;
      },
      showSuccessMsg: false
    });
  });

  // 联动：角色列表「用户数」跳转携带 ?role=<pk> —— 由 RePlusPage 的
  // routeParams 装配（route.query → 搜索默认值）自动生效，页面无需再注入：
  // 首开后二次手动刷新会覆盖请求序号，导致首开内联元数据被丢弃（表格无列）。

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
    baseColumnsFormat
  };
}
