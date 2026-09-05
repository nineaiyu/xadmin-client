import "./reset.css";
import { getCurrentInstance, onMounted, reactive, ref, type Ref } from "vue";
import { userApi } from "@/api/system/user";
import { getDefaultAuths } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { handleOperation, usePublicHooks } from "@/components/RePlusPage";
import { deviceDetection } from "@pureadmin/utils";
import { rulesPasswordApi } from "@/api/auth";
import type { PasswordRule } from "@/api/auth";

import { useUserOptions } from "./useUserOptions";
import { useUserAvatarUpload } from "./useUserAvatarUpload";
import { useUserResetPassword } from "./useUserResetPassword";
import { useUserColumnFormats } from "./useUserColumnFormats";
import { useUserButtons } from "./useUserButtons";

/**
 * 用户视图组装入口（T2.5 拆分自 604 行单体）：
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
    ...getDefaultAuths(getCurrentInstance(), [
      "resetPassword",
      "empower",
      "logout",
      "unblock"
    ])
  });
  const switchLoadMap = ref({});
  const { switchStyle } = usePublicHooks();
  const selectedNum = ref(0);
  const manySelectData = ref([]);
  const passwordRules = ref<PasswordRule[]>([]);

  const { treeData, treeLoading, onTreeSelect } = useUserOptions(
    auth,
    tableRef
  );
  const { handleUpload } = useUserAvatarUpload({ t, api, tableRef });
  const { handleReset } = useUserResetPassword({ t, api, passwordRules });
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
      handleRoleRules
    });

  // 全局密码规则（重置密码与新增/编辑表单校验共用）
  onMounted(() => {
    handleOperation({
      t,
      apiReq: rulesPasswordApi(),
      success({ data: { password_rules } }) {
        passwordRules.value = password_rules;
      },
      showSuccessMsg: false
    });
  });

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
