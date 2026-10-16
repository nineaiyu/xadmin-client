import type { Ref, UnwrapNestedRefs } from "vue";
import type { useI18n } from "vue-i18n";
import type { usePublicHooks } from "@/components/RePlusPage";
import type { userApi } from "@/api/identity/user";
import type { PasswordRule } from "@/api/auth";
import type { RecordType } from "plus-pro-components";
import { useUserListColumns } from "./useUserListColumns";
import { useUserFormOptions } from "./useUserFormOptions";
import { useUserRoleRules } from "./useUserRoleRules";

type TFunction = ReturnType<typeof useI18n>["t"];
type SwitchStyle = ReturnType<typeof usePublicHooks>["switchStyle"];

/**
 * 用户视图列渲染与表单格式化（装配入口，职责拆分）：
 * - useUserListColumns  列表列渲染（头像/用户名抽屉入口、性别、启停、邀请状态、标签、岗位）；
 * - useUserFormOptions  新增/编辑表单格式化（一步邀请、密码/手机号校验、beforeSubmit）；
 * - useUserRoleRules    角色/权限授权弹窗列与授权提交。
 */
export function useUserColumnFormats({
  t,
  api,
  auth,
  switchLoadMap,
  switchStyle,
  passwordRules,
  tableRef,
  openUserPanel
}: {
  t: TFunction;
  api: UnwrapNestedRefs<typeof userApi>;
  auth: { unblock?: boolean };
  switchLoadMap: Ref<Record<string, unknown>>;
  switchStyle: SwitchStyle;
  passwordRules: { value: PasswordRule[] };
  tableRef: Ref;
  openUserPanel: (row: RecordType) => void;
}) {
  const { listColumnsFormat } = useUserListColumns({
    t,
    api,
    auth,
    switchLoadMap,
    switchStyle,
    openUserPanel
  });

  const { addOrEditOptions } = useUserFormOptions({ t, passwordRules });

  const { roleRules, roleRulesColumns, baseColumnsFormat, handleRoleRules } =
    useUserRoleRules({ t, api, tableRef });

  return {
    roleRules,
    roleRulesColumns,
    listColumnsFormat,
    addOrEditOptions,
    baseColumnsFormat,
    handleRoleRules
  };
}
